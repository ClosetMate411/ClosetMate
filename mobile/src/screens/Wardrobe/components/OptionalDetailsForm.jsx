import React, { memo, useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { palette } from '../../../theme/colors';

const WEATHER_TYPES = ['Spring', 'Summer', 'Fall', 'Winter'];

function OptionalDetailsForm({ onSave, onSkip }) {
  const [itemName, setItemName] = useState('');
  const [selectedWeather, setSelectedWeather] = useState('');
  const [error, setError] = useState('');

  const handleWeatherChange = useCallback((weather) => {
    setSelectedWeather((prev) => (prev === weather ? '' : weather));
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = itemName.trim();
    if (trimmed && trimmed.length > 100) {
      setError('Item name is too long (max 100 chars).');
      return;
    }

    setError('');
    onSave?.({
      itemName: trimmed || undefined,
      weather: selectedWeather || undefined,
    });
  }, [itemName, selectedWeather, onSave]);

  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: palette.text, fontWeight: '600' }}>Item Name</Text>
      <TextInput
        placeholder="Enter Item Name"
        value={itemName}
        onChangeText={(v) => {
          setItemName(v);
          if (error) setError('');
        }}
        placeholderTextColor={palette.textMuted}
        style={{ borderWidth: 1, borderColor: error ? palette.danger : palette.borderStrong, borderRadius: 10, padding: 12, backgroundColor: palette.surface, color: palette.text }}
      />
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}

      <Text style={{ color: palette.text, fontWeight: '600' }}>Weather</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {WEATHER_TYPES.map((weather) => {
          const active = selectedWeather === weather;
          return (
            <Pressable
              key={weather}
              onPress={() => handleWeatherChange(weather)}
              style={{ paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 999, borderColor: active ? palette.primary : palette.borderStrong, backgroundColor: active ? palette.primarySoft : palette.surface }}
            >
              <Text style={{ color: palette.text }}>{weather}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Pressable onPress={handleSkip} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.borderStrong, backgroundColor: palette.surfaceSoft }}>
          <Text style={{ color: palette.text }}>SKIP</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center', borderColor: palette.primary, backgroundColor: palette.primary }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(OptionalDetailsForm);
