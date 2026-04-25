import { StyleSheet } from 'react-native';
import { palette } from '../../theme/colors';
import { radius, shadow, spacing, type } from '../../theme/tokens';

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.background,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  title: {
    ...type.h1,
    color: palette.text,
    fontWeight: '700',
  },
  helperText: {
    ...type.body,
    color: palette.textMuted,
    textAlign: 'center',
  },
  label: {
    ...type.label,
    color: palette.text,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceElevated,
    color: palette.text,
    ...shadow.soft,
  },
  button: {
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.primary,
    ...shadow.soft,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryLink: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  secondaryLinkText: {
    color: palette.primaryStrong,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: palette.surfaceElevated,
    gap: spacing.xs,
    ...shadow.soft,
  },
  errorText: {
    color: palette.danger,
  },
});
