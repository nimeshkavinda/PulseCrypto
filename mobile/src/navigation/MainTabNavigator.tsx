import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabParamList, RootDrawerParamList } from './types.js';
import { TerminalScreen } from '../screens/TerminalScreen.js';
import { MarketsScreen } from '../screens/MarketsScreen.js';
import { TelemetryScreen } from '../screens/TelemetryScreen.js';
import { SettingsScreen } from '../screens/SettingsScreen.js';
import { colors, typography, spacing, borderRadius } from '../theme/tokens.js';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function MainTabNavigator() {
  const drawerNavigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();

  const renderHeaderLeft = () => (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={() => drawerNavigation.openDrawer()}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="menu-outline" size={24} color={colors.textPrimary} />
    </TouchableOpacity>
  );

  const renderHeaderRight = () => (
    <View style={styles.statusPill}>
      <View style={styles.liveDot} />
      <Text style={styles.statusPillText}>Live 100ms</Text>
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
          height: 60,
          paddingBottom: spacing.sm,
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

const styles = StyleSheet.create({
  headerButton: {
    marginLeft: spacing.lg,
    padding: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    backgroundColor: colors.bidGreenSubtle,
    borderColor: colors.bidGreen,
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bidGreen,
    marginRight: spacing.xs,
  },
  statusPillText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
});
