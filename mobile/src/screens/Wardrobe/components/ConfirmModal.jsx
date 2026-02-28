import React, { memo, useMemo } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

function ConfirmModal({ opened, onClose, onConfirm, title, message, subtitle, variant = 'delete' }) {
  const config = useMemo(() => {
    switch (variant) {
      case 'delete':
        return { icon: '🗑️', confirmLabel: 'Delete', cancelLabel: 'Cancel' };
      case 'save':
        return { icon: '💾', confirmLabel: 'Save', cancelLabel: 'Cancel' };
      case 'unsaved':
        return { icon: '⚠️', confirmLabel: 'Leave', cancelLabel: 'Cancel' };
      default:
        return { icon: '🗑️', confirmLabel: 'Confirm', cancelLabel: 'Cancel' };
    }
  }, [variant]);

  return (
    <Modal visible={opened} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 380, backgroundColor: palette.surface, borderRadius: 14, padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 28, textAlign: 'center' }}>{config.icon}</Text>
          {title ? <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'center', color: palette.text }}>{title}</Text> : null}
          {message ? <Text style={{ textAlign: 'center', color: palette.textMuted }}>{message}</Text> : null}
          {subtitle ? <Text style={{ textAlign: 'center', color: palette.textMuted }}>{subtitle}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable onPress={onClose} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
              <Text style={{ color: palette.text }}>{config.cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onConfirm?.();
                onClose?.();
              }}
              style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: variant === 'delete' ? palette.danger : palette.primary, backgroundColor: variant === 'delete' ? palette.dangerSoft : palette.primary }}
            >
              <Text style={{ color: variant === 'delete' ? palette.danger : '#fff', fontWeight: '700' }}>{config.confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default memo(ConfirmModal);
