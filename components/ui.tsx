import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, TextProps, View } from 'react-native';

export function Screen({ children }: { children: ReactNode }) {
  return <ScrollView style={{ flex: 1, backgroundColor: '#0f172a' }} contentContainerStyle={{ padding: 20, gap: 16 }}>{children}</ScrollView>;
}

export function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children?: ReactNode }) {
  return (
    <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: '#1f2937' }}>
      {title ? <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>{title}</Text> : null}
      {subtitle ? <Text style={{ color: '#94a3b8' }}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function Field(props: any) {
  return <TextInput placeholderTextColor="#64748b" style={{ backgroundColor: '#020617', color: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#334155' }} {...props} />;
}

export function Button({ title, onPress, disabled }: { title: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={{ backgroundColor: disabled ? '#475569' : '#22c55e', padding: 14, borderRadius: 12, alignItems: 'center' }}>
      <Text style={{ color: '#020617', fontWeight: '800' }}>{title}</Text>
    </Pressable>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={{ color: '#e2e8f0', fontWeight: '600' }}>{children}</Text>;
}

export function Muted({ children, ...props }: { children: ReactNode } & TextProps) {
  return <Text style={{ color: '#94a3b8' }} {...props}>{children}</Text>;
}
