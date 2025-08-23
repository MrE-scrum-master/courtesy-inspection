// PhotoGallery Component - Swipe, zoom, fullscreen support
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/theme';
import { getDeviceInfo } from '../utils/responsive';
import { Button } from './Button';
import { Card } from './Card';

export interface PhotoItem {
  id: string;
  uri: string;
  thumbnailUri?: string;
  title?: string;
  description?: string;
  timestamp?: string;
  category?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    type?: string;
  };
}

export interface PhotoGalleryProps {
  photos: PhotoItem[];
  columns?: number;
  spacing?: number;
  aspectRatio?: number;
  
  // Interaction
  onPhotoPress?: (photo: PhotoItem, index: number) => void;
  onPhotoLongPress?: (photo: PhotoItem, index: number) => void;
  
  // Fullscreen viewer
  enableFullscreen?: boolean;
  initialPhotoIndex?: number;
  showFullscreenViewer?: boolean;
  onFullscreenClose?: () => void;
  
  // Actions
  shareEnabled?: boolean;
  downloadEnabled?: boolean;
  deleteEnabled?: boolean;
  onShare?: (photo: PhotoItem) => void;
  onDownload?: (photo: PhotoItem) => void;
  onDelete?: (photo: PhotoItem) => void;
  
  // Layout
  showTitles?: boolean;
  showTimestamps?: boolean;
  showCategories?: boolean;
  groupByCategory?: boolean;
  
  // Loading & Error
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  
  // Styling
  borderRadius?: number;
  imageQuality?: 'low' | 'medium' | 'high';
  
  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  columns = 2,
  spacing = 8,
  aspectRatio = 1,
  onPhotoPress,
  onPhotoLongPress,
  enableFullscreen = true,
  initialPhotoIndex = 0,
  showFullscreenViewer = false,
  onFullscreenClose,
  shareEnabled = true,
  downloadEnabled = false,
  deleteEnabled = false,
  onShare,
  onDownload,
  onDelete,
  showTitles = false,
  showTimestamps = false,
  showCategories = false,
  groupByCategory = false,
  loading = false,
  error = null,
  emptyMessage = 'No photos available',
  borderRadius = 8,
  imageQuality = 'medium',
  accessibilityLabel = 'Photo gallery',
  testID = 'photo-gallery',
}) => {
  const deviceInfo = getDeviceInfo();
  const [fullscreenVisible, setFullscreenVisible] = useState(showFullscreenViewer);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialPhotoIndex);
  const flatListRef = useRef<FlatList>(null);
  
  // Screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Calculate photo dimensions
  const photoWidth = useMemo(() => {
    const totalSpacing = spacing * (columns + 1);
    return (screenWidth - totalSpacing) / columns;
  }, [screenWidth, columns, spacing]);
  
  const photoHeight = photoWidth / aspectRatio;
  
  // Group photos by category if needed
  const groupedPhotos = useMemo(() => {
    if (!groupByCategory) {
      return [{ category: null, photos }];
    }
    
    const groups = photos.reduce((acc, photo) => {
      const category = photo.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(photo);
      return acc;
    }, {} as Record<string, PhotoItem[]>);
    
    return Object.entries(groups).map(([category, photos]) => ({
      category,
      photos,
    }));
  }, [photos, groupByCategory]);
  
  // Handle photo press
  const handlePhotoPress = useCallback((photo: PhotoItem, index: number) => {
    if (enableFullscreen) {
      setCurrentPhotoIndex(index);
      setFullscreenVisible(true);
    }
    onPhotoPress?.(photo, index);
  }, [enableFullscreen, onPhotoPress]);
  
  // Handle photo long press
  const handlePhotoLongPress = useCallback((photo: PhotoItem, index: number) => {
    if (deleteEnabled || shareEnabled || downloadEnabled) {
      Alert.alert(
        'Photo Actions',
        photo.title || 'Select an action',
        [
          { text: 'Cancel', style: 'cancel' },
          ...(shareEnabled ? [{
            text: 'Share',
            onPress: () => handleShare(photo)
          }] : []),
          ...(downloadEnabled ? [{
            text: 'Download',
            onPress: () => onDownload?.(photo)
          }] : []),
          ...(deleteEnabled ? [{
            text: 'Delete',
            style: 'destructive' as const,
            onPress: () => handleDelete(photo)
          }] : []),
        ]
      );
    }
    onPhotoLongPress?.(photo, index);
  }, [deleteEnabled, shareEnabled, downloadEnabled, onDownload, onPhotoLongPress]);
  
  // Handle share
  const handleShare = useCallback(async (photo: PhotoItem) => {
    try {
      if (onShare) {
        onShare(photo);
      } else {
        await Share.share({
          url: photo.uri,
          message: photo.title || 'Check out this photo',
        });
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  }, [onShare]);
  
  // Handle delete
  const handleDelete = useCallback((photo: PhotoItem) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(photo)
        },
      ]
    );
  }, [onDelete]);
  
  // Close fullscreen viewer
  const closeFullscreenViewer = useCallback(() => {
    setFullscreenVisible(false);
    onFullscreenClose?.();
  }, [onFullscreenClose]);
  
  // Render individual photo
  const renderPhoto = ({ item: photo, index }: { item: PhotoItem; index: number }) => (
    <TouchableOpacity
      style={[
        styles.photoContainer,
        {
          width: photoWidth,
          height: photoHeight,
          marginBottom: spacing,
          borderRadius,
        },
      ]}
      onPress={() => handlePhotoPress(photo, index)}
      onLongPress={() => handlePhotoLongPress(photo, index)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={photo.title || `Photo ${index + 1}`}
      testID={`${testID}-photo-${index}`}
    >
      <Image
        source={{ uri: photo.thumbnailUri || photo.uri }}
        style={[styles.photo, { borderRadius }]}
        resizeMode="cover"
        fadeDuration={200}
      />
      
      {/* Overlay for additional info */}
      {(showTitles || showTimestamps || showCategories) && (
        <View style={styles.photoOverlay}>
          {showCategories && photo.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{photo.category}</Text>
            </View>
          )}
          
          {showTitles && photo.title && (
            <Text style={styles.photoTitle} numberOfLines={1}>
              {photo.title}
            </Text>
          )}
          
          {showTimestamps && photo.timestamp && (
            <Text style={styles.photoTimestamp}>
              {new Date(photo.timestamp).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
  
  // Render category section
  const renderCategorySection = ({ item: group }: { item: any }) => (
    <View style={styles.categorySection}>
      {group.category && (
        <Text style={styles.categoryTitle}>{group.category}</Text>
      )}
      <FlatList
        data={group.photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.photosContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="images-outline" size={64} color={COLORS.gray[400]} />
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );
  
  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
  
  // Render loading state
  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <Text style={styles.loadingText}>Loading photos...</Text>
    </View>
  );
  
  return (
    <View style={styles.container} testID={testID}>
      {loading ? (
        renderLoadingState()
      ) : error ? (
        renderErrorState()
      ) : photos.length === 0 ? (
        renderEmptyState()
      ) : groupByCategory ? (
        <FlatList
          data={groupedPhotos}
          renderItem={renderCategorySection}
          keyExtractor={(item) => item.category || 'uncategorized'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
        />
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={styles.photosContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Fullscreen Photo Viewer */}
      {enableFullscreen && (
        <FullscreenPhotoViewer
          visible={fullscreenVisible}
          photos={photos}
          initialIndex={currentPhotoIndex}
          onClose={closeFullscreenViewer}
          shareEnabled={shareEnabled}
          downloadEnabled={downloadEnabled}
          onShare={handleShare}
          onDownload={onDownload}
        />
      )}
    </View>
  );
};

// Fullscreen Photo Viewer Component
interface FullscreenPhotoViewerProps {
  visible: boolean;
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
  shareEnabled: boolean;
  downloadEnabled: boolean;
  onShare?: (photo: PhotoItem) => void;
  onDownload?: (photo: PhotoItem) => void;
}

const FullscreenPhotoViewer: React.FC<FullscreenPhotoViewerProps> = ({
  visible,
  photos,
  initialIndex,
  onClose,
  shareEnabled,
  downloadEnabled,
  onShare,
  onDownload,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Animation values for zoom
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const currentPhoto = photos[currentIndex];
  
  // Reset animation values when photo changes
  const resetZoom = useCallback(() => {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  }, []);
  
  // Handle page change
  const handlePageChange = useCallback((index: number) => {
    setCurrentIndex(index);
    resetZoom();
  }, [resetZoom]);
  
  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(event.scale, 0.5, 3);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 2.5) {
        scale.value = withSpring(2.5);
      }
    });
  
  // Pan gesture for moving when zoomed
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });
  
  // Double tap gesture for zoom toggle
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        scale.value = withSpring(2);
      }
    });
  
  // Combined gesture
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );
  
  // Animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));
  
  // Render fullscreen photo
  const renderFullscreenPhoto = ({ item, index }: { item: PhotoItem; index: number }) => (
    <View style={[styles.fullscreenPhotoContainer, { width: screenWidth }]}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.fullscreenPhotoWrapper, animatedStyle]}>
          <Image
            source={{ uri: item.uri }}
            style={styles.fullscreenPhoto}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
  
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.fullscreenContainer}>
        {/* Photo Viewer */}
        <FlatList
          ref={flatListRef}
          data={photos}
          renderItem={renderFullscreenPhoto}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            handlePageChange(index);
          }}
        />
        
        {/* Header */}
        <View style={styles.fullscreenHeader}>
          <TouchableOpacity onPress={onClose} style={styles.fullscreenButton}>
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>
          
          <View style={styles.fullscreenInfo}>
            <Text style={styles.fullscreenCounter}>
              {currentIndex + 1} of {photos.length}
            </Text>
            {currentPhoto?.title && (
              <Text style={styles.fullscreenTitle}>{currentPhoto.title}</Text>
            )}
          </View>
          
          <View style={styles.fullscreenActions}>
            {shareEnabled && (
              <TouchableOpacity
                onPress={() => onShare?.(currentPhoto)}
                style={styles.fullscreenButton}
              >
                <Ionicons name="share-outline" size={24} color={COLORS.white} />
              </TouchableOpacity>
            )}
            
            {downloadEnabled && (
              <TouchableOpacity
                onPress={() => onDownload?.(currentPhoto)}
                style={styles.fullscreenButton}
              >
                <Ionicons name="download-outline" size={24} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Footer with photo info */}
        {(currentPhoto?.description || currentPhoto?.timestamp) && (
          <View style={styles.fullscreenFooter}>
            {currentPhoto.description && (
              <Text style={styles.fullscreenDescription}>
                {currentPhoto.description}
              </Text>
            )}
            {currentPhoto.timestamp && (
              <Text style={styles.fullscreenTimestamp}>
                {new Date(currentPhoto.timestamp).toLocaleString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  photosContainer: {
    padding: SPACING.md,
  },
  row: {
    justifyContent: 'space-around',
  },
  categorySection: {
    marginBottom: SPACING.xl,
  },
  categoryTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  photoContainer: {
    position: 'relative',
    backgroundColor: COLORS.gray[100],
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
    padding: SPACING.sm,
  },
  categoryBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  photoTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  photoTimestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.error,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  fullscreenPhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPhotoWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPhoto: {
    width: '100%',
    height: '100%',
  },
  fullscreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    background: 'linear-gradient(rgba(0,0,0,0.5), transparent)',
  },
  fullscreenButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  fullscreenCounter: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  fullscreenTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: 2,
    textAlign: 'center',
  },
  fullscreenActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  fullscreenFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
  },
  fullscreenDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
  },
  fullscreenTimestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: SPACING.sm,
  },
});