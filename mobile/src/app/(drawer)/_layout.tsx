import { Drawer } from 'expo-router/drawer';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProTraderDrawerContent } from '../../components/drawer/ProTraderDrawerContent';
import { colors, typography, spacing } from '../../theme/tokens';

export default function DrawerLayout() {
  const router = useRouter();

  const renderBackToTabs = () => (
    <TouchableOpacity
      style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
      onPress={() => router.navigate('/')}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Back to Terminal"
    >
      <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
    </TouchableOpacity>
  );

  const screenHeaderOptions = {
    headerShown: true,
    headerLeft: renderBackToTabs,
    headerStyle: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    headerTitleStyle: {
      color: colors.textPrimary,
      fontFamily: typography.fontFamily.heading,
      fontSize: typography.fontSize.subtitle,
    },
    headerTintColor: colors.textPrimary,
  };

  return (
    <Drawer
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
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="api-keys"
        options={{
          drawerLabel: 'API Keys',
          title: 'API Keys',
          ...screenHeaderOptions,
        }}
      />
      <Drawer.Screen
        name="security"
        options={{
          drawerLabel: 'Security',
          title: 'Security',
          ...screenHeaderOptions,
        }}
      />
      <Drawer.Screen
        name="trade-history"
        options={{
          drawerLabel: 'Trade History',
          title: 'Trade History',
          ...screenHeaderOptions,
        }}
      />
      <Drawer.Screen
        name="support"
        options={{
          drawerLabel: 'Support',
          title: 'Support',
          ...screenHeaderOptions,
        }}
      />
    </Drawer>
  );
}
