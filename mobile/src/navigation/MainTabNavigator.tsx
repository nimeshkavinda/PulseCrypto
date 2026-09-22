import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabParamList, RootDrawerParamList } from './types';
import { TerminalScreen } from '../screens/TerminalScreen';
import { MarketsScreen } from '../screens/MarketsScreen';
import { TelemetryScreen } from '../screens/TelemetryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors, typography, spacing } from '../theme/tokens';
import { styles } from './MainTabNavigator.styles';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function MainTabNavigator() {
  const drawerNavigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  const insets = useSafeAreaInsets();

  const renderHeaderLeft = () => (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={() => drawerNavigation.openDrawer()}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
    >
      <Ionicons name="menu-outline" size={24} color={colors.textPrimary} />
    </TouchableOpacity>
  );

  const renderHeaderRight = () => (
    <View style={styles.statusPill}>
      <View style={styles.liveDot} />
      <Text style={styles.statusPillText}>LIVE</Text>
    </View>
  );

  return (
    <Tab.Navigator
      initialRouteName="Terminal"
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontSize: typography.fontSize.subtitle,
          fontWeight: typography.fontWeight.bold,
        },
        headerLeft: renderHeaderLeft,
        headerRight: renderHeaderRight,
        headerTitleAlign: 'center',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 54 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          paddingTop: spacing.xs,
        },
        tabBarActiveTintColor: colors.bidGreen,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.medium,
        },
      }}
    >
      <Tab.Screen
        name="Terminal"
        component={TerminalScreen}
        options={{
          title: 'Terminal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Markets"
        component={MarketsScreen}
        options={{
          title: 'Markets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Telemetry"
        component={TelemetryScreen}
        options={{
          title: 'Telemetry',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
