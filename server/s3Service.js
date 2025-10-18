import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'figuroai-audio';

/**
 * Upload audio file to S3
 * @param {string} userId - User ID
 * @param {string} idiom - Idiom text
 * @param {string} base64Audio - Base64 encoded audio data
 * @returns {Promise<string>} - S3 URL of uploaded file
 */
export async function uploadAudioToS3(userId, idiom, base64Audio) {
  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    
    // Create unique filename
    const sanitizedIdiom = idiom.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const key = `audio/${userId}/${sanitizedIdiom}_${timestamp}.mp3`;
    
    // Upload to S3
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      // Note: No ACL - bucket uses BucketOwnerEnforced
    };
    
    const result = await s3.upload(params).promise();
    console.log(`✅ Audio uploaded to S3: ${result.Location}`);
    
    // Generate a signed URL that expires in 7 days (for public access)
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 604800 // 7 days in seconds
    });
    
    console.log(`✅ Generated signed URL (expires in 7 days)`);
    return signedUrl;
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    throw error;
  }
}

/**
 * Delete audio file from S3
 * @param {string} audioUrl - S3 URL to delete
 */
export async function deleteAudioFromS3(audioUrl) {
  try {
    // Extract key from URL
    const url = new URL(audioUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    console.log(`✅ Audio deleted from S3: ${key}`);
  } catch (error) {
    console.error('❌ S3 delete error:', error);
    throw error;
  }
}

export default { uploadAudioToS3, deleteAudioFromS3 };
