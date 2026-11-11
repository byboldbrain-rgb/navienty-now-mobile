import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  getCachedServiceCategoryImages,
  listServiceCategoryImages,
  type ServiceCategoryImage,
} from '../services/service-category-image-service';

/**
 * Optional remote artwork configuration. Never delays screen rendering.
 * Revalidates on navigation focus (with a 30-second shared cache), so
 * database-only updates are picked up without rebuilding the mobile app.
 */
export function useServiceCategoryImages(
  placement: string,
): ServiceCategoryImage[] {
  const [images, setImages] = useState<ServiceCategoryImage[]>(
    () => getCachedServiceCategoryImages(placement) ?? [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void listServiceCategoryImages(placement).then(
        (items) => {
          if (active) {
            setImages(items);
          }
        },
        (error) => {
          // Preserve bundled/legacy artwork when the table is temporarily
          // unavailable or the user's network is offline.
          if (__DEV__) {
            console.warn(
              '[category-images] Unable to load category artwork:',
              error,
            );
          }
        },
      );

      return () => {
        active = false;
      };
    }, [placement]),
  );

  return images;
}
