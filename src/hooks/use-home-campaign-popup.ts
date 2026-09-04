import {
    useFocusEffect,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useState,
} from 'react';
import { Image } from 'react-native';

import {
    type CampaignPopup,
    loadEligibleCampaignPopup,
    markCampaignPopupPresented,
    openCampaignPopupAction,
} from '../services/campaign-popup-service';

type CampaignAudience =
  | 'signed_in'
  | 'signed_out';

type UseHomeCampaignPopupInput = {
  audience: CampaignAudience | null;
  serviceAreaId: string | null;
};

type UseHomeCampaignPopupResult = {
  campaign: CampaignPopup | null;
  visible: boolean;
  dismiss: () => void;
  markPresented: (
    campaign: CampaignPopup,
  ) => void;
  runPrimaryAction: () => Promise<void>;
};

export function useHomeCampaignPopup({
  audience,
  serviceAreaId,
}: UseHomeCampaignPopupInput): UseHomeCampaignPopupResult {
  const router = useRouter();
  const [campaign, setCampaign] =
    useState<CampaignPopup | null>(null);
  const [visible, setVisible] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let showTimer: ReturnType<
        typeof setTimeout
      > | null = null;

      if (!audience) {
        setCampaign(null);
        setVisible(false);
        return;
      }

      const loadCampaign = async () => {
        try {
          const nextCampaign =
            await loadEligibleCampaignPopup(
              audience,
              serviceAreaId,
            );

          if (cancelled) {
            return;
          }

          if (
            nextCampaign?.imageUrl.startsWith(
              'http://',
            ) ||
            nextCampaign?.imageUrl.startsWith(
              'https://',
            )
          ) {
            try {
              await Image.prefetch(
                nextCampaign.imageUrl,
              );
            } catch {
              // DynamicCampaignPopup handles image failures safely.
            }
          }

          if (cancelled) {
            return;
          }

          setCampaign(nextCampaign);
          setVisible(false);

          if (nextCampaign) {
            showTimer = setTimeout(() => {
              if (!cancelled) {
                setVisible(true);
              }
            }, nextCampaign.config.showDelayMs);
          }
        } catch (error) {
          if (!cancelled) {
            setCampaign(null);
            setVisible(false);

            console.warn(
              'Unable to load dynamic campaign popup.',
              error,
            );
          }
        }
      };

      void loadCampaign();

      return () => {
        cancelled = true;

        if (showTimer) {
          clearTimeout(showTimer);
        }

        setVisible(false);
      };
    }, [audience, serviceAreaId]),
  );

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const markPresented = useCallback(
    (presentedCampaign: CampaignPopup) => {
      void markCampaignPopupPresented(
        presentedCampaign,
      );
    },
    [],
  );

  const runPrimaryAction = useCallback(
    async () => {
      if (!campaign) {
        setVisible(false);
        return;
      }

      try {
        await openCampaignPopupAction({
          campaign,
          router,
        });
      } catch (error) {
        console.warn(
          'Unable to open campaign popup action.',
          error,
        );
      } finally {
        setVisible(false);
      }
    },
    [campaign, router],
  );

  return {
    campaign,
    visible,
    dismiss,
    markPresented,
    runPrimaryAction,
  };
}
