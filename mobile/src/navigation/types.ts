import type { NavigatorScreenParams } from '@react-navigation/native';

export type BottomTabParamList = {
  Terminal: { symbol?: string } | undefined;
  Markets: undefined;
  Telemetry: undefined;
  Settings: undefined;
};

export type RootDrawerParamList = {
  MainTabs: NavigatorScreenParams<BottomTabParamList>;
};
