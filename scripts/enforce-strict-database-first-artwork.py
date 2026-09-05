from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{relative_path}: expected exactly one match, found {count}: {old[:180]!r}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"PATCHED: {relative_path}")


# Login: the local hero remains bundled as the failure/missing-DB fallback,
# but it must not become visible while the bootstrap artwork map is unresolved.
replace_once(
    "src/app/login.tsx",
    """              opacity:\n                authLoadingPulse,""",
    """              opacity:\n                authHeroArtwork.isResolved\n                  ? authLoadingPulse\n                  : 0,""",
)

replace_once(
    "src/app/login.tsx",
    """                  style={\n                    styles.heroArtworkImage\n                  }""",
    """                  style={[\n                    styles.heroArtworkImage,\n                    !authHeroArtwork.isResolved && {\n                      opacity: 0,\n                    },\n                  ]}""",
)

replace_once(
    "src/app/login.tsx",
    """                  style={{\n                    height:\n                      secondaryArtworkHeight,\n\n                    width:\n                      secondaryArtworkWidth,\n                  }}""",
    """                  style={{\n                    height:\n                      secondaryArtworkHeight,\n                    opacity:\n                      authHeroArtwork.isResolved\n                        ? 1\n                        : 0,\n                    width:\n                      secondaryArtworkWidth,\n                  }}""",
)

# React bootstrap: keep the native splash (the unavoidable pre-JS local asset)
# covering the React layer until both database-first artwork lookups resolve.
replace_once(
    "src/app/_layout.tsx",
    """      onLayout={hideNativeSplash}\n    >""",
    """      onLayout={() => {\n        if (bootstrapArtworkResolved) {\n          hideNativeSplash();\n        }\n      }}\n    >""",
)

print("Strict database-first artwork priority enforced.")
