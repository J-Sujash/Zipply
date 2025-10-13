import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Colors, Spacing, FontSize } from '../../constants/Colors';

interface PickerProps {
  label?: string;
  value: string | number;
  onValueChange: (value: string | number) => void;
  items: { label: string; value: string | number }[];
  error?: string;
  required?: boolean;
  containerStyle?: any;
}

export function Picker({
  label,
  value,
  onValueChange,
  items,
  error,
  required,
  containerStyle,
}: PickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  
  const selectedItem = items.find(item => item.value === value);
  
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.pickerContainer, error && styles.pickerError]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.pickerText, !selectedItem && styles.placeholder]}>
          {selectedItem ? selectedItem.label : 'Select an option'}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select an option'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    item.value === value && styles.selectedItem,
                  ]}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      item.value === value && styles.selectedItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  required: {
    color: Colors.error,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  pickerError: {
    borderColor: Colors.error,
  },
  pickerText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  placeholder: {
    color: Colors.textSecondary,
  },
  arrow: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    width: '90%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  modalItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  selectedItem: {
    backgroundColor: Colors.primary + '10',
  },
  modalItemText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  selectedItemText: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
