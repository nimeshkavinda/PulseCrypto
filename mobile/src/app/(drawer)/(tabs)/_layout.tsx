import { Tabs } from 'expo-router';
import { TouchableOpacity, View, Text } from 'react-native';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../../theme/tokens';
import { styles } from '../../../components/navigation/TabBar.styles';

import { HeaderStatusPill, statusColor } from '../../../components/navigation/HeaderStatusPill';
import { useActivePair, useConnectionState, useUpstream } from '../../../data/store/hooks';
import { describeStatus } from '../../../data/connectionStatus';
import { SUPPORTED_PAIRS } from '@pulsecrypto/shared';
export { ScreenErrorBoundary as ErrorBoundary } from '../../../components/common/ScreenErrorBoundary';

export default function TabLayout() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const activePair = useActivePair();
  const status = describeStatus(useConnectionState(), useUpstream());

  const pairDisplayName = SUPPORTED_PAIRS[activePair]?.displayName || 'BTC/USDT';

  const renderHeaderLeft = () => (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
    >
      <Ionicons name="menu" size={24} color={colors.bidGreen} />
    </TouchableOpacity>
  );

  const isConnected = status.tone === 'live';
  const toneColor = statusColor(status.tone);
  const statusLabel = status.label;

  return (
    <Tabs
      screenOptions={{
        // Tabs stay mounted; freezing hidden ones stops them re-rendering on every market update.
        freezeOnBlur: true,
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
          fontFamily: typography.fontFamily.heading,
        },
        headerLeft: renderHeaderLeft,
        headerRight: () => <HeaderStatusPill />,
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
          fontFamily: typography.fontFamily.medium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitleAlign: 'left',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.subtitle,
                  fontFamily: typography.fontFamily.heading,
                  marginRight: 8,
                }}
              >
                {pairDisplayName}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isConnected ? 'rgba(0, 197, 122, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 10,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: toneColor,
                    marginRight: 4,
                  }}
                />
                <Text
                  style={{
                    color: toneColor,
                    fontSize: 10,
                    fontFamily: typography.fontFamily.monoBold,
                    letterSpacing: 0.5,
                  }}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
          ),
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <Ionicons name="radio" size={20} color={toneColor} />
            </View>
          ),
          tabBarLabel: 'Terminal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Markets',
          tabBarLabel: 'Markets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="telemetry"
        options={{
          title: 'Telemetry',
          tabBarLabel: 'Telemetry',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
