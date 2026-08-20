'use strict';

const path = require('node:path');

module.exports = function navientyCachedImagePlugin({ types: t }) {
  return {
    name: 'navienty-cached-image',

    visitor: {
      Program(programPath, state) {
        const filename = state.filename;

        if (
          !filename ||
          !filename.includes(`${path.sep}src${path.sep}`)
        ) {
          return;
        }

        const normalizedFilename = path.normalize(filename);
        const wrapperPath = path.normalize(
          path.join(
            process.cwd(),
            'src',
            'components',
            'ui',
            'app-image.tsx',
          ),
        );

        // Never rewrite the wrapper itself.
        if (normalizedFilename === wrapperPath) {
          return;
        }

        let reactNativeImportPath = null;
        let imageSpecifierPath = null;
        let localImageName = null;

        for (const bodyPath of programPath.get('body')) {
          if (
            !bodyPath.isImportDeclaration() ||
            bodyPath.node.source.value !== 'react-native'
          ) {
            continue;
          }

          const specifierPaths = bodyPath.get('specifiers');

          for (const specifierPath of specifierPaths) {
            if (!specifierPath.isImportSpecifier()) {
              continue;
            }

            const imported = specifierPath.node.imported;
            const importedName =
              t.isIdentifier(imported)
                ? imported.name
                : imported.value;

            if (importedName !== 'Image') {
              continue;
            }

            reactNativeImportPath = bodyPath;
            imageSpecifierPath = specifierPath;
            localImageName = specifierPath.node.local.name;
            break;
          }

          if (imageSpecifierPath) {
            break;
          }
        }

        if (
          !reactNativeImportPath ||
          !imageSpecifierPath ||
          !localImageName
        ) {
          return;
        }

        let jsxImageCount = 0;
        let hasNonJsxImageReference = false;

        programPath.traverse({
          JSXOpeningElement(jsxPath) {
            if (
              t.isJSXIdentifier(jsxPath.node.name) &&
              jsxPath.node.name.name === localImageName
            ) {
              jsxImageCount += 1;
            }
          },

          ReferencedIdentifier(identifierPath) {
            if (identifierPath.node.name === localImageName) {
              hasNonJsxImageReference = true;
            }
          },
        });

        // Keep files that use Image.getSize, Image.resolveAssetSource,
        // Animated.createAnimatedComponent(Image), etc. on React Native Image.
        // We only replace files where Image is used as JSX exclusively.
        if (
          jsxImageCount === 0 ||
          hasNonJsxImageReference
        ) {
          return;
        }

        let cachedImageLocalName = 'AppImage';

        if (programPath.scope.hasBinding(cachedImageLocalName)) {
          cachedImageLocalName = 'NavientyCachedImage';
        }

        const absoluteWrapperWithoutExtension = wrapperPath.replace(
          /\.tsx$/,
          '',
        );

        let relativeImportPath = path.relative(
          path.dirname(normalizedFilename),
          absoluteWrapperWithoutExtension,
        );

        relativeImportPath = relativeImportPath
          .split(path.sep)
          .join('/');

        if (!relativeImportPath.startsWith('.')) {
          relativeImportPath = `./${relativeImportPath}`;
        }

        imageSpecifierPath.remove();

        if (reactNativeImportPath.node.specifiers.length === 0) {
          reactNativeImportPath.remove();
        }

        const cachedImport = t.importDeclaration(
          [
            t.importDefaultSpecifier(
              t.identifier(cachedImageLocalName),
            ),
          ],
          t.stringLiteral(relativeImportPath),
        );

        const bodyPaths = programPath.get('body');
        const lastImportPath = [...bodyPaths]
          .reverse()
          .find((bodyPath) => bodyPath.isImportDeclaration());

        if (lastImportPath) {
          lastImportPath.insertAfter(cachedImport);
        } else {
          programPath.unshiftContainer('body', cachedImport);
        }

        programPath.traverse({
          JSXOpeningElement(jsxPath) {
            if (
              t.isJSXIdentifier(jsxPath.node.name) &&
              jsxPath.node.name.name === localImageName
            ) {
              jsxPath.node.name = t.jsxIdentifier(
                cachedImageLocalName,
              );
            }
          },

          JSXClosingElement(jsxPath) {
            if (
              t.isJSXIdentifier(jsxPath.node.name) &&
              jsxPath.node.name.name === localImageName
            ) {
              jsxPath.node.name = t.jsxIdentifier(
                cachedImageLocalName,
              );
            }
          },
        });
      },
    },
  };
};
