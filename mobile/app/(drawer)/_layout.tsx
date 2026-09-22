import { Drawer } from 'expo-router/drawer';
import { ProTraderDrawerContent } from '../../src/navigation/drawer/ProTraderDrawerContent';
import { colors } from '../../src/theme/tokens';

export default function DrawerLayout() {
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
          headerShown: false,
          drawerLabel: 'Trading',
        }}
      />
    </Drawer>
  );
}
