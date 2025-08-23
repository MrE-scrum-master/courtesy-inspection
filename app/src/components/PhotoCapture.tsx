import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, UPLOAD_CONSTRAINTS } from '@/constants';
import type { PhotoCapture as PhotoCaptureType } from '@/types/common';

interface PhotoCaptureProps {
  onPhotoCapture: (photo: PhotoCaptureType) => void;
  onPhotoRemove?: () => void;
  existingPhoto?: string;
  disabled?: boolean;
  maxPhotos?: number;
  currentPhotoCount?: number;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onPhotoCapture,
  onPhotoRemove,
  existingPhoto,
  disabled = false,
  maxPhotos = 5,
  currentPhotoCount = 0,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera and photo library permissions to take and select photos.'
      );
      return false;
    }
    return true;
  };

  const validateImage = (result: ImagePicker.ImagePickerResult): boolean => {
    if (result.canceled || !result.assets?.[0]) {
      return false;
    }

    const asset = result.assets[0];
    
    // Check file size
    if (asset.fileSize && asset.fileSize > UPLOAD_CONSTRAINTS.IMAGE.MAX_SIZE) {
      Alert.alert(
        'File Too Large',
        `Image must be smaller than ${UPLOAD_CONSTRAINTS.IMAGE.MAX_SIZE / (1024 * 1024)}MB`
      );
      return false;
    }

    // Check dimensions
    const { width, height } = asset;
    const maxDimensions = UPLOAD_CONSTRAINTS.IMAGE.MAX_DIMENSIONS;
    if (width > maxDimensions.width || height > maxDimensions.height) {
      Alert.alert(
        'Image Too Large',
        `Image dimensions must be smaller than ${maxDimensions.width}x${maxDimensions.height}px`
      );
      return false;
    }

    return true;
  };

  const handleImagePicked = (result: ImagePicker.ImagePickerResult) => {
    if (!validateImage(result)) {
      return;
    }

    const asset = result.assets?.[0];
    if (!asset) return;

    const photo: PhotoCaptureType = {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      type: asset.type || 'image',
    };

    if (asset.base64) {
      photo.base64 = asset.base64;
    }

    onPhotoCapture(photo);
  };

  const takePhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      setIsLoading(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      handleImagePicked(result);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectPhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      setIsLoading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      handleImagePicked(result);
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you would like to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: selectPhoto },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRemovePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onPhotoRemove },
      ]
    );
  };

  const canAddPhoto = currentPhotoCount < maxPhotos;

  if (existingPhoto) {
    return (
      <View style={styles.photoContainer}>
        <Image source={{ uri: existingPhoto }} style={styles.photoPreview} />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemovePhoto}
          disabled={disabled}
        >
          <Ionicons name="close-circle" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.captureButton,
        disabled && styles.disabledButton,
        !canAddPhoto && styles.maxPhotosButton,
      ]}
      onPress={showImageOptions}
      disabled={disabled || isLoading || !canAddPhoto}
    >
      <Ionicons
        name="camera"
        size={24}
        color={
          disabled || !canAddPhoto
            ? COLORS.text.tertiary
            : COLORS.primary
        }
      />
      <Text
        style={[
          styles.captureButtonText,
          (disabled || !canAddPhoto) && styles.disabledText,
        ]}
      >
        {isLoading
          ? 'Processing...'
          : !canAddPhoto
          ? `Max ${maxPhotos} photos`
          : 'Add Photo'}
      </Text>
      {maxPhotos > 1 && (
        <Text style={styles.photoCount}>
          {currentPhotoCount}/{maxPhotos}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background.secondary,
    minHeight: 80,
  },
  disabledButton: {
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.gray[100],
  },
  maxPhotosButton: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.background.secondary,
  },
  captureButtonText: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  disabledText: {
    color: COLORS.text.tertiary,
  },
  photoCount: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[200],
  },
  removeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
});

export default PhotoCapture;