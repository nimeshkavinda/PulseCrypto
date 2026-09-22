import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { RootDrawerParamList } from './types.js';
import { MainTabNavigator } from './MainTabNavigator.js';
import { ProTraderDrawerContent } from './drawer/ProTraderDrawerContent.js';
import { colors } from '../theme/tokens.js';

const Drawer = createDrawerNavigator<RootDrawerParamList>();

export function RootNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={() => <ProTraderDrawerContent />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.surface,
          width: 300,
        },
        drawerType: 'front',
        overlayColor: 'rgba(0, 0, 0, 0.7)',
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabNavigator} />
    </Drawer.Navigator>
  );
}
