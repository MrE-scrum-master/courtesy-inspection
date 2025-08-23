// Customer Portal Screen - Read-only public access
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerPortal, usePortalTokenValidation } from '@/hooks/useCustomerPortal';
import { getDeviceInfo } from '@/utils/responsive';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '@/constants/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InspectionRecommendation, InspectionPhoto } from '@/hooks/useCustomerPortal';

interface CustomerPortalScreenProps {
  token: string;
}

export const CustomerPortalScreen: React.FC<CustomerPortalScreenProps> = ({ token }) => {
  const deviceInfo = getDeviceInfo();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [callbackRequested, setCallbackRequested] = useState(false);
  
  // Validate token first
  const { data: tokenValidation, isLoading: validationLoading } = usePortalTokenValidation(token);
  
  // Portal data (read-only)
  const {
    portalData,
    accessStatus,
    inspectionSummary,
    prioritizedRecommendations,
    photosByCategory,
    isLoading,
    error,
    isAccessValid,
    daysUntilExpiration,
    canSubmitFeedback,
    canRequestCallback,
    trackPortalView,
    downloadReport,
    submitFeedback,
    requestCallback,
    shareInspection,
  } = useCustomerPortal(token);
  
  // Track portal view on mount
  useEffect(() => {
    if (isAccessValid && portalData) {
      trackPortalView();
    }
  }, [isAccessValid, portalData, trackPortalView]);
  
  // Computed display values (no business logic)
  const overallStatus = useMemo(() => {
    if (!inspectionSummary) return null;
    
    const { overallScore, needsAttentionItems, poorItems } = inspectionSummary;
    
    if (overallScore >= 80) {
      return { text: 'Excellent Condition', color: COLORS.success, icon: 'checkmark-circle' };
    } else if (overallScore >= 60) {
      return { text: 'Good Condition', color: COLORS.warning, icon: 'alert-circle' };
    } else if (needsAttentionItems > 0 || poorItems > 0) {
      return { text: 'Needs Attention', color: COLORS.error, icon: 'warning' };
    } else {
      return { text: 'Fair Condition', color: COLORS.warning, icon: 'alert-circle' };
    }
  }, [inspectionSummary]);
  
  const urgentRecommendations = useMemo(() => {
    return prioritizedRecommendations.filter(rec => rec.urgency === 'immediate');
  }, [prioritizedRecommendations]);
  
  // Handle feedback submission
  const handleFeedbackSubmit = async (rating: number, comments?: string) => {
    try {
      await submitFeedback({
        rating,
        comments,
        recommendToFriend: rating >= 4,
        serviceAreas: {
          communication: rating,
          timeliness: rating,
          thoroughness: rating,
          value: rating,
        },
      });
      setFeedbackSubmitted(true);
      Alert.alert('Thank You!', 'Your feedback has been submitted.');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    }
  };
  
  // Handle callback request
  const handleCallbackRequest = async () => {
    try {
      const phoneNumber = portalData?.customer.phone || '';
      await requestCallback({
        preferredTime: 'morning',
        preferredDate: new Date().toISOString().split('T')[0],
        topic: 'questions',
        message: 'Requesting callback regarding inspection results',
        phoneNumber,
      });
      setCallbackRequested(true);
      Alert.alert('Request Sent', 'We will call you back within 24 hours.');
    } catch (error) {
      Alert.alert('Error', 'Failed to request callback. Please try again.');
    }
  };
  
  // Handle report download
  const handleDownloadReport = async () => {
    try {
      await downloadReport('pdf');
    } catch (error) {
      Alert.alert('Error', 'Failed to download report. Please try again.');
    }
  };
  
  // Handle share inspection
  const handleShareInspection = async () => {
    try {
      const shareUrl = `${window.location.origin}/portal/${token}`;
      await Share.share({
        message: `View my vehicle inspection report: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.log('Share cancelled or failed:', error);
    }
  };
  
  // Handle shop contact
  const handleContactShop = () => {
    if (!portalData?.shopInfo) return;
    
    Alert.alert(
      'Contact Shop',
      'How would you like to contact us?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => Linking.openURL(`tel:${portalData.shopInfo.phone}`)
        },
        { 
          text: 'Email', 
          onPress: () => Linking.openURL(`mailto:${portalData.shopInfo.email}`)
        },
      ]
    );
  };
  
  // Loading states
  if (validationLoading || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner message="Loading your inspection report..." />
      </View>
    );
  }
  
  // Token validation errors
  if (!tokenValidation?.isValid) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>Invalid Access</Text>
        <Text style={styles.errorMessage}>
          {tokenValidation?.reason === 'invalid_token' 
            ? 'This inspection link is invalid or has expired.'
            : 'Unable to access inspection report. Please contact the shop.'}
        </Text>
        
        <Button
          variant="primary"
          onPress={() => window.history.back()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
    );
  }
  
  // Portal access errors
  if (error || !isAccessValid) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="time-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>Access Expired</Text>
        <Text style={styles.errorMessage}>
          This inspection report has expired. Please contact the shop for a new link.
        </Text>
        
        {portalData?.shopInfo && (
          <Button
            variant="primary"
            onPress={handleContactShop}
            style={styles.backButton}
          >
            Contact Shop
          </Button>
        )}
      </View>
    );
  }
  
  // Main portal content
  return (
    <ErrorBoundary>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.shopInfo}>
            {portalData?.shopInfo.logoUrl && (
              <View style={styles.logoContainer}>
                {/* Logo would go here */}
                <Ionicons name="car-outline" size={32} color={COLORS.primary} />
              </View>
            )}
            
            <View>
              <Text style={styles.shopName}>{portalData?.shopInfo.name}</Text>
              <Text style={styles.headerSubtitle}>Vehicle Inspection Report</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              onPress={handleDownloadReport}
            >
              <Ionicons name="download-outline" size={16} color={COLORS.text.primary} />
              Download
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onPress={handleShareInspection}
            >
              <Ionicons name="share-outline" size={16} color={COLORS.text.primary} />
              Share
            </Button>
          </View>
        </View>
        
        {/* Access Notice */}
        {daysUntilExpiration !== null && daysUntilExpiration <= 7 && (
          <Card style={styles.noticeCard}>
            <View style={styles.noticeContent}>
              <Ionicons name="time-outline" size={20} color={COLORS.warning} />
              <Text style={styles.noticeText}>
                This report expires in {daysUntilExpiration} day{daysUntilExpiration !== 1 ? 's' : ''}
              </Text>
            </View>
          </Card>
        )}
        
        {/* Customer & Vehicle Info */}
        <Card style={styles.infoCard}>
          <Text style={styles.cardTitle}>Vehicle Information</Text>
          <View style={styles.infoGrid}>
            <InfoItem 
              label="Customer" 
              value={portalData?.customer.name || 'Unknown'} 
            />
            <InfoItem 
              label="Vehicle" 
              value={`${portalData?.vehicle.year} ${portalData?.vehicle.make} ${portalData?.vehicle.model}`} 
            />
            <InfoItem 
              label="Inspection Date" 
              value={new Date(inspectionSummary?.completedDate || '').toLocaleDateString()} 
            />
            <InfoItem 
              label="Mechanic" 
              value={inspectionSummary?.mechanicName || 'Unknown'} 
            />
          </View>
        </Card>
        
        {/* Overall Status */}
        {overallStatus && (
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={overallStatus.icon as any} 
                size={32} 
                color={overallStatus.color} 
              />
              <View style={styles.statusInfo}>
                <Text style={[styles.statusText, { color: overallStatus.color }]}>
                  {overallStatus.text}
                </Text>
                <Text style={styles.statusScore}>
                  Overall Score: {inspectionSummary?.overallScore.toFixed(0)}%
                </Text>
              </View>
            </View>
            
            <View style={styles.statusBreakdown}>
              <StatusItem 
                label="Good" 
                count={inspectionSummary?.goodItems || 0} 
                color={COLORS.success} 
              />
              <StatusItem 
                label="Fair" 
                count={inspectionSummary?.fairItems || 0} 
                color={COLORS.warning} 
              />
              <StatusItem 
                label="Needs Attention" 
                count={inspectionSummary?.needsAttentionItems || 0} 
                color={COLORS.error} 
              />
            </View>
          </Card>
        )}
        
        {/* Urgent Recommendations */}
        {urgentRecommendations.length > 0 && (
          <Card style={styles.urgentCard}>
            <View style={styles.urgentHeader}>
              <Ionicons name="warning" size={24} color={COLORS.error} />
              <Text style={styles.urgentTitle}>Immediate Attention Required</Text>
            </View>
            
            {urgentRecommendations.map((rec) => (
              <RecommendationItem 
                key={rec.id} 
                recommendation={rec}
                isUrgent={true}
              />
            ))}
          </Card>
        )}
        
        {/* All Recommendations */}
        {prioritizedRecommendations.length > 0 && (
          <Card style={styles.recommendationsCard}>
            <Text style={styles.cardTitle}>Recommendations</Text>
            
            {prioritizedRecommendations.map((rec) => (
              <RecommendationItem 
                key={rec.id} 
                recommendation={rec}
                isUrgent={false}
              />
            ))}
          </Card>
        )}
        
        {/* Photos */}
        {Object.keys(photosByCategory).length > 0 && (
          <Card style={styles.photosCard}>
            <Text style={styles.cardTitle}>Inspection Photos</Text>
            
            {Object.entries(photosByCategory).map(([category, photos]) => (
              <PhotoCategory 
                key={category}
                category={category}
                photos={photos}
              />
            ))}
          </Card>
        )}
        
        {/* Cost Summary */}
        {inspectionSummary?.totalEstimatedCost && inspectionSummary.totalEstimatedCost > 0 && (
          <Card style={styles.costCard}>
            <Text style={styles.cardTitle}>Estimated Costs</Text>
            <View style={styles.costSummary}>
              <Text style={styles.costTotal}>
                ${inspectionSummary.totalEstimatedCost.toFixed(2)}
              </Text>
              <Text style={styles.costLabel}>Total Estimated Cost</Text>
            </View>
            
            <Text style={styles.costDisclaimer}>
              * This is an estimate. Final costs may vary based on parts availability and labor.
            </Text>
          </Card>
        )}
        
        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.cardTitle}>What's Next?</Text>
          
          <View style={styles.actionButtons}>
            {canRequestCallback && !callbackRequested && (
              <Button
                variant="primary"
                onPress={handleCallbackRequest}
                style={styles.actionButton}
              >
                <Ionicons name="call-outline" size={20} color={COLORS.white} />
                Request Callback
              </Button>
            )}
            
            <Button
              variant="secondary"
              onPress={handleContactShop}
              style={styles.actionButton}
            >
              <Ionicons name="chatbubble-outline" size={20} color={COLORS.text.primary} />
              Contact Shop
            </Button>
            
            <Button
              variant="secondary"
              onPress={() => {
                if (portalData?.shopInfo.website) {
                  Linking.openURL(portalData.shopInfo.website);
                }
              }}
              style={styles.actionButton}
            >
              <Ionicons name="globe-outline" size={20} color={COLORS.text.primary} />
              Visit Website
            </Button>
          </View>
        </Card>
        
        {/* Feedback */}
        {canSubmitFeedback && !feedbackSubmitted && (
          <Card style={styles.feedbackCard}>
            <Text style={styles.cardTitle}>Rate Your Experience</Text>
            <Text style={styles.feedbackPrompt}>
              How was your experience with our inspection service?
            </Text>
            
            <View style={styles.ratingButtons}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant={rating >= 4 ? 'success' : rating >= 3 ? 'warning' : 'danger'}
                  size="sm"
                  onPress={() => handleFeedbackSubmit(rating)}
                  style={styles.ratingButton}
                >
                  {rating}★
                </Button>
              ))}
            </View>
          </Card>
        )}
        
        {/* Shop Info Footer */}
        <Card style={styles.shopFooter}>
          <Text style={styles.shopFooterTitle}>{portalData?.shopInfo.name}</Text>
          <Text style={styles.shopAddress}>{portalData?.shopInfo.address}</Text>
          <Text style={styles.shopContact}>
            {portalData?.shopInfo.phone} • {portalData?.shopInfo.email}
          </Text>
          
          {portalData?.shopInfo.businessHours && (
            <View style={styles.businessHours}>
              <Text style={styles.hoursTitle}>Business Hours:</Text>
              {portalData.shopInfo.businessHours.map((hours) => (
                <Text key={hours.dayOfWeek} style={styles.hoursText}>
                  {hours.dayOfWeek}: {hours.isClosed ? 'Closed' : `${hours.openTime} - ${hours.closeTime}`}
                </Text>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </ErrorBoundary>
  );
};

// Helper Components (Pure Presentation)

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const StatusItem: React.FC<{ label: string; count: number; color: string }> = ({ 
  label, count, color 
}) => (
  <View style={styles.statusItem}>
    <Text style={[styles.statusCount, { color }]}>{count}</Text>
    <Text style={styles.statusLabel}>{label}</Text>
  </View>
);

const RecommendationItem: React.FC<{ 
  recommendation: InspectionRecommendation;
  isUrgent: boolean;
}> = ({ recommendation, isUrgent }) => {
  const priorityColors = {
    low: COLORS.success,
    medium: COLORS.warning,
    high: COLORS.error,
  };
  
  return (
    <View style={[
      styles.recommendationItem,
      isUrgent && styles.urgentRecommendation
    ]}>
      <View style={styles.recommendationHeader}>
        <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
        <Text style={[
          styles.recommendationCost,
          { color: priorityColors[recommendation.priority] }
        ]}>
          ${recommendation.estimatedCost.toFixed(2)}
        </Text>
      </View>
      
      <Text style={styles.recommendationDescription}>
        {recommendation.description}
      </Text>
      
      <View style={styles.recommendationFooter}>
        <View style={[
          styles.priorityBadge,
          { backgroundColor: priorityColors[recommendation.priority] }
        ]}>
          <Text style={styles.priorityText}>
            {recommendation.priority.toUpperCase()}
          </Text>
        </View>
        
        <Text style={styles.urgencyText}>
          {recommendation.urgency === 'immediate' ? 'Immediate' :
           recommendation.urgency === 'soon' ? 'Within 30 days' : 'Future'}
        </Text>
      </View>
    </View>
  );
};

const PhotoCategory: React.FC<{ 
  category: string; 
  photos: InspectionPhoto[] 
}> = ({ category, photos }) => (
  <View style={styles.photoCategory}>
    <Text style={styles.photoCategoryTitle}>{category}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.photoRow}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoContainer}>
            {/* Photo placeholder - actual image would be here */}
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={32} color={COLORS.gray[400]} />
            </View>
            <Text style={styles.photoDescription}>{photo.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background.primary,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
  },
  backButton: {
    marginTop: SPACING.xl,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  shopName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  noticeCard: {
    margin: SPACING.lg,
    backgroundColor: COLORS.warning,
  },
  noticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.sm,
  },
  infoCard: {
    margin: SPACING.lg,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: SPACING.md,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  statusCard: {
    margin: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  statusScore: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  statusBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusCount: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  statusLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  urgentCard: {
    margin: SPACING.lg,
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  urgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  urgentTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  recommendationsCard: {
    margin: SPACING.lg,
  },
  recommendationItem: {
    backgroundColor: COLORS.background.secondary,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  urgentRecommendation: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  recommendationTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
  },
  recommendationCost: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  recommendationDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.sm,
  },
  recommendationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  urgencyText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  photosCard: {
    margin: SPACING.lg,
  },
  photoCategory: {
    marginBottom: SPACING.lg,
  },
  photoCategoryTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  photoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  photoDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    maxWidth: 80,
  },
  costCard: {
    margin: SPACING.lg,
  },
  costSummary: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  costTotal: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  costLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
  },
  costDisclaimer: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionsCard: {
    margin: SPACING.lg,
  },
  actionButtons: {
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  feedbackCard: {
    margin: SPACING.lg,
  },
  feedbackPrompt: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  shopFooter: {
    margin: SPACING.lg,
    marginTop: SPACING.xl,
  },
  shopFooterTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  shopAddress: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  shopContact: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
  },
  businessHours: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  hoursTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  hoursText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
});