import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Theme = {
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
};

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  theme: Theme;
  primaryColor: string;
};

/** Modal + list based dropdown -- avoids pulling in a native picker dependency. */
function OptionPicker({ label, value, options, onChange, theme, primaryColor }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.value, { color: value ? theme.textPrimary : theme.textSecondary }]}>
          {value || label}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={item => item}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: item === value ? primaryColor : theme.textPrimary },
                      item === value && styles.optionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  value: { fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  list: { marginBottom: 4 },
  option: { paddingVertical: 14 },
  optionText: { fontSize: 15 },
  optionTextSelected: { fontWeight: '700' },
});

export default OptionPicker;
