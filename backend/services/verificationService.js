/**
 * Verification Service
 * 
 * PURPOSE:
 * Handles all driver verification business logic including:
 * - Document submission and tracking
 * - Verification workflow management
 * - Expiration alerts
 * - Admin approval/rejection
 * - Audit trail
 * 
 * ARCHITECTURE:
 * Service Pattern: Encapsulates verification business logic
 * Scalability: Works with batch verification processes
 * Error Handling: Comprehensive error logging
 * 
 * REAL-WORLD: Mirrors Grab/Uber driver onboarding verification systems
 */

const { DriverVerification, VERIFICATION_STATUS, DOCUMENT_TYPES, DOCUMENT_STATUS } = require('../models/DriverVerification');
const User = require('../models/User');
const { getIo } = require('../socket');

class VerificationService {
  /**
   * Create initial verification record when driver signs up
   * Called during driver registration
   */
  static async createInitialVerification(driverId) {
    try {
      // Check if already exists
      let verification = await DriverVerification.findOne({ driverId });
      if (verification) return verification;

      // Create new verification record
      verification = new DriverVerification({
        driverId,
        status: VERIFICATION_STATUS.PENDING,
        documents: [],
        submittedAt: new Date(),
      });

      // Add to audit trail
      verification.verificationHistory.push({
        action: 'submitted',
        timestamp: new Date(),
        performedBy: driverId,
        notes: 'Initial verification record created',
      });

      await verification.save();
      return verification;
    } catch (error) {
      console.error('Error creating initial verification:', error);
      throw error;
    }
  }

  /**
   * Upload/update a driver document
   */
  static async uploadDocument(driverId, documentType, fileUrl, fileName, expiryDate = null) {
    try {
      let verification = await DriverVerification.findOne({ driverId });
      if (!verification) {
        verification = await this.createInitialVerification(driverId);
      }

      // Remove existing document of same type
      verification.documents = verification.documents.filter((d) => d.type !== documentType);

      // Add new document
      verification.documents.push({
        type: documentType,
        status: DOCUMENT_STATUS.PENDING,
        fileUrl,
        fileName,
        expiryDate,
        uploadedAt: new Date(),
      });

      // Add to history
      verification.verificationHistory.push({
        action: 'document_uploaded',
        timestamp: new Date(),
        performedBy: driverId,
        notes: `${documentType} uploaded`,
      });

      // Reset status to pending if was rejected
      if (verification.status === VERIFICATION_STATUS.REJECTED) {
        verification.status = VERIFICATION_STATUS.PENDING;
      }

      await verification.save();

      // Notify admin that new document ready for review
      this.notifyAdminNewDocuments(driverId);

      return verification;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Verify a single document (admin action)
   */
  static async verifyDocument(driverId, documentType, adminId, verificationNotes = null) {
    try {
      const verification = await DriverVerification.findOne({ driverId });
      if (!verification) throw new Error('Verification record not found');

      const doc = verification.documents.find((d) => d.type === documentType);
      if (!doc) throw new Error(`Document ${documentType} not found`);

      doc.status = DOCUMENT_STATUS.VERIFIED;
      doc.verifiedBy = adminId;
      doc.verificationNotes = verificationNotes;
      doc.verifiedAt = new Date();

      await verification.save();

      // Check if all documents verified → auto-approve
      if (this.allDocumentsVerified(verification)) {
        await this.approveVerification(driverId, adminId, 'All documents verified');
      }

      return verification;
    } catch (error) {
      console.error('Error verifying document:', error);
      throw error;
    }
  }

  /**
   * Reject a document (admin action)
   */
  static async rejectDocument(driverId, documentType, adminId, rejectionReason) {
    try {
      const verification = await DriverVerification.findOne({ driverId });
      if (!verification) throw new Error('Verification record not found');

      const doc = verification.documents.find((d) => d.type === documentType);
      if (!doc) throw new Error(`Document ${documentType} not found`);

      doc.status = DOCUMENT_STATUS.REJECTED;
      doc.rejectionReason = rejectionReason;
      doc.verifiedBy = adminId;
      doc.verifiedAt = new Date();

      // Set overall status to rejected if not already
      if (verification.status === VERIFICATION_STATUS.APPROVED) {
        verification.status = VERIFICATION_STATUS.REJECTED;
        verification.rejectedAt = new Date();
      }

      await verification.save();

      // Notify driver of rejection
      await this.notifyDriverDocumentRejection(driverId, documentType, rejectionReason);

      return verification;
    } catch (error) {
      console.error('Error rejecting document:', error);
      throw error;
    }
  }

  /**
   * Approve driver verification (admin action)
   */
  static async approveVerification(driverId, adminId, approvalNotes = null) {
    try {
      const verification = await DriverVerification.findOne({ driverId });
      if (!verification) throw new Error('Verification record not found');

      // Check all documents are verified
      if (!this.allDocumentsVerified(verification)) {
        throw new Error('Not all documents have been verified');
      }

      verification.status = VERIFICATION_STATUS.APPROVED;
      verification.approvedAt = new Date();
      verification.reviewedBy = adminId;
      verification.approvalNotes = approvalNotes;

      verification.verificationHistory.push({
        action: 'approved',
        timestamp: new Date(),
        performedBy: adminId,
        notes: approvalNotes,
      });

      await verification.save();

      // Update user document with verification status
      await User.findByIdAndUpdate(driverId, {
        isVerified: true,
        verificationStatus: VERIFICATION_STATUS.APPROVED,
      });

      // Notify driver of approval
      await this.notifyDriverApproved(driverId);

      // Broadcast to admins
      const io = getIo();
      io.to('admin_room').emit('driver_verified', {
        driverId,
        status: VERIFICATION_STATUS.APPROVED,
        timestamp: new Date(),
      });

      return verification;
    } catch (error) {
      console.error('Error approving verification:', error);
      throw error;
    }
  }

  /**
   * Reject entire verification (admin action)
   */
  static async rejectVerification(driverId, adminId, rejectionReason) {
    try {
      const verification = await DriverVerification.findOne({ driverId });
      if (!verification) throw new Error('Verification record not found');

      verification.status = VERIFICATION_STATUS.REJECTED;
      verification.rejectedAt = new Date();
      verification.reviewedBy = adminId;

      verification.verificationHistory.push({
        action: 'rejected',
        timestamp: new Date(),
        performedBy: adminId,
        notes: rejectionReason,
      });

      await verification.save();

      // Update user
      await User.findByIdAndUpdate(driverId, {
        isVerified: false,
        verificationStatus: VERIFICATION_STATUS.REJECTED,
      });

      // Notify driver
      await this.notifyDriverRejected(driverId, rejectionReason);

      return verification;
    } catch (error) {
      console.error('Error rejecting verification:', error);
      throw error;
    }
  }

  /**
   * Suspend driver verification (admin action)
   * Used when driver violates policies
   */
  static async suspendVerification(driverId, adminId, suspensionReason) {
    try {
      const verification = await DriverVerification.findOne({ driverId });
      if (!verification) throw new Error('Verification record not found');

      verification.status = VERIFICATION_STATUS.SUSPENDED;
      verification.suspendedAt = new Date();

      verification.verificationHistory.push({
        action: 'suspended',
        timestamp: new Date(),
        performedBy: adminId,
        notes: suspensionReason,
      });

      await verification.save();

      // Update user status
      await User.findByIdAndUpdate(driverId, {
        status: 'suspended',
        verificationStatus: VERIFICATION_STATUS.SUSPENDED,
      });

      return verification;
    } catch (error) {
      console.error('Error suspending verification:', error);
      throw error;
    }
  }

  /**
   * Check for expiring documents and create alerts
   * Run periodically (daily)
   */
  static async checkExpiringDocuments() {
    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const expiringVerifications = await DriverVerification.find({
        status: VERIFICATION_STATUS.APPROVED,
        'documents.expiryDate': {
          $lte: thirtyDaysFromNow,
          $gt: new Date(),
        },
      });

      for (const verification of expiringVerifications) {
        if (!verification.expiryAlert) {
          verification.expiryAlert = true;
          await verification.save();

          // Notify driver
          await this.notifyDriverExpiringDocuments(verification.driverId, verification.expiringDocuments);
        }
      }

      return expiringVerifications.length;
    } catch (error) {
      console.error('Error checking expiring documents:', error);
      throw error;
    }
  }

  /**
   * Get verification status for driver
   */
  static async getVerificationStatus(driverId) {
    try {
      const verification = await DriverVerification.findOne({ driverId }).populate(
        'verificationHistory.performedBy',
        'name email'
      );
      return verification;
    } catch (error) {
      console.error('Error getting verification status:', error);
      throw error;
    }
  }

  /**
   * Get all pending verifications for admin review
   */
  static async getPendingVerifications(limit = 50, skip = 0) {
    try {
      const pending = await DriverVerification.find({
        status: VERIFICATION_STATUS.UNDER_REVIEW,
      })
        .populate('driverId', 'name email phone')
        .populate('assignedToAdmin', 'name')
        .sort({ submittedAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await DriverVerification.countDocuments({
        status: VERIFICATION_STATUS.UNDER_REVIEW,
      });

      return { pending, total };
    } catch (error) {
      console.error('Error getting pending verifications:', error);
      throw error;
    }
  }

  /**
   * Get verification summary for dashboard
   */
  static async getVerificationSummary() {
    try {
      const stats = await DriverVerification.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const summary = {
        pending: 0,
        underReview: 0,
        approved: 0,
        rejected: 0,
        suspended: 0,
        total: 0,
      };

      stats.forEach((stat) => {
        switch (stat._id) {
          case VERIFICATION_STATUS.PENDING:
            summary.pending = stat.count;
            break;
          case VERIFICATION_STATUS.UNDER_REVIEW:
            summary.underReview = stat.count;
            break;
          case VERIFICATION_STATUS.APPROVED:
            summary.approved = stat.count;
            break;
          case VERIFICATION_STATUS.REJECTED:
            summary.rejected = stat.count;
            break;
          case VERIFICATION_STATUS.SUSPENDED:
            summary.suspended = stat.count;
            break;
        }
      });

      summary.total = stats.reduce((sum, stat) => sum + stat.count, 0);

      return summary;
    } catch (error) {
      console.error('Error getting verification summary:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  static allDocumentsVerified(verification) {
    const requiredDocs = Object.values(DOCUMENT_TYPES);
    const verifiedTypes = verification.documents
      .filter((d) => d.status === DOCUMENT_STATUS.VERIFIED)
      .map((d) => d.type);

    return requiredDocs.every((required) => verifiedTypes.includes(required));
  }

  static async notifyAdminNewDocuments(driverId) {
    // Broadcast to admin dashboard
    const io = getIo();
    io.to('admin_room').emit('verification_documents_ready', {
      driverId,
      timestamp: new Date(),
    });
  }

  static async notifyDriverDocumentRejection(driverId, documentType, reason) {
    // Send notification via Firebase/email
    console.log(`[NOTIFICATION] Driver ${driverId} document ${documentType} rejected: ${reason}`);
  }

  static async notifyDriverApproved(driverId) {
    console.log(`[NOTIFICATION] Driver ${driverId} verification approved`);
  }

  static async notifyDriverRejected(driverId, reason) {
    console.log(`[NOTIFICATION] Driver ${driverId} verification rejected: ${reason}`);
  }

  static async notifyDriverExpiringDocuments(driverId, expiringDocs) {
    console.log(`[NOTIFICATION] Driver ${driverId} has expiring documents: ${expiringDocs.join(', ')}`);
  }
}

module.exports = VerificationService;
