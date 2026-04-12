import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { ServerService } from '@affine/core/modules/cloud';
import type { SettingTab } from '@affine/core/modules/dialogs/constant';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { EmbeddingSettings } from '@affine/core/modules/workspace-indexer-embedding';
import { ServerDeploymentType } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  AiEmbeddingIcon,
  CollaborationIcon,
  IntegrationsIcon,
  PaymentIcon,
  SaveIcon,
  SettingsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useMemo } from 'react';

import type { SettingSidebarItem, SettingState } from '../types';
import { WorkspaceSettingBilling } from './billing';
import { IntegrationSetting } from './integration';
import { WorkspaceSettingLicense } from './license';
import { MembersPanel } from './members';
import { WorkspaceSettingDetail } from './preference';
import { WorkspaceSettingStorage } from './storage';

export const WorkspaceSetting = ({
  activeTab,
  scrollAnchor,
  onCloseSetting,
  onChangeSettingState,
}: {
  activeTab: SettingTab;
  scrollAnchor?: string;
  onCloseSetting: () => void;
  onChangeSettingState: (settingState: SettingState) => void;
}) => {
  switch (activeTab) {
    case 'workspace:preference':
      return <WorkspaceSettingDetail onCloseSetting={onCloseSetting} />;
    case 'workspace:members':
      return (
        <MembersPanel
          onCloseSetting={onCloseSetting}
          onChangeSettingState={onChangeSettingState}
        />
      );
    case 'workspace:billing':
      return <WorkspaceSettingBilling />;
    case 'workspace:storage':
      return <WorkspaceSettingStorage onCloseSetting={onCloseSetting} />;
    case 'workspace:license':
      return <WorkspaceSettingLicense onCloseSetting={onCloseSetting} />;
    case 'workspace:integrations':
      return <IntegrationSetting scrollAnchor={scrollAnchor} />;
    case 'workspace:embedding':
      return <EmbeddingSettings />;
    default:
      return null;
  }
};

export const useWorkspaceSettingList = (): SettingSidebarItem[] => {
  const workspaceService = useService(WorkspaceService);
  const information = useWorkspaceInfo(workspaceService.workspace);
  const serverService = useService(ServerService);
  const workspacePermissionService = useService(WorkspacePermissionService);

  const isSelfhosted = useLiveData(
    serverService.server.config$.selector(
      c => c.type === ServerDeploymentType.Selfhosted
    )
  );

  // Revalidate permissions so isOwner is populated
  useEffect(() => {
    workspacePermissionService.permission.revalidate();
  }, [workspacePermissionService]);

  // Only workspace owners (master admins) see admin-only tabs
  const isOwner = useLiveData(workspacePermissionService.permission.isOwner$);

  const t = useI18n();

  const showBilling =
    !isSelfhosted && information?.isTeam && information?.isOwner;
  const showLicense = information?.isOwner && isSelfhosted;
  const items = useMemo<SettingSidebarItem[]>(() => {
    return [
      {
        key: 'workspace:preference',
        title: t['com.affine.settings.workspace.preferences'](),
        icon: <SettingsIcon />,
        testId: 'workspace-setting:preference',
      },
      // workspace:properties removed — admin-only in Voxa
      isOwner && {
        key: 'workspace:members' as SettingTab,
        title: t['Members'](),
        icon: <CollaborationIcon />,
        testId: 'workspace-setting:members',
      },
      isOwner && {
        key: 'workspace:integrations' as SettingTab,
        title: t['com.affine.integration.integrations'](),
        icon: <IntegrationsIcon />,
        testId: 'workspace-setting:integrations',
      },
      isOwner && {
        key: 'workspace:storage' as SettingTab,
        title: t['Storage'](),
        icon: <SaveIcon />,
        testId: 'workspace-setting:storage',
      },
      isOwner && {
        key: 'workspace:embedding' as SettingTab,
        title:
          t[
            'com.affine.settings.workspace.indexer-embedding.embedding.title'
          ](),
        icon: <AiEmbeddingIcon />,
        testId: 'workspace-setting:embedding',
      },
      showBilling && {
        key: 'workspace:billing' as SettingTab,
        title: t['com.affine.settings.workspace.billing'](),
        icon: <PaymentIcon />,
        testId: 'workspace-setting:billing',
      },
      showLicense && {
        key: 'workspace:license' as SettingTab,
        title: t['com.affine.settings.workspace.license'](),
        icon: <PaymentIcon />,
        testId: 'workspace-setting:license',
      },
    ].filter((item): item is SettingSidebarItem => !!item);
  }, [isOwner, showBilling, showLicense, t]);

  return items;
};
