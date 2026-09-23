export const AppState = {
  currentState: 'active',
  addEventListener: (_type: string, _listener: (state: string) => void) => ({
    remove: () => {},
  }),
};

export const Platform = {
  OS: 'ios',
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T | undefined => obj.ios ?? obj.default,
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};

export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const ScrollView = 'ScrollView';
export const TextInput = 'TextInput';
export const Switch = 'Switch';
export const ActivityIndicator = 'ActivityIndicator';
export const RefreshControl = 'RefreshControl';
export const PanResponder = {
  create: () => ({
    panHandlers: {},
  }),
};

export const Alert = {
  alert: () => {},
};

export default {
  AppState,
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  PanResponder,
  Alert,
};
