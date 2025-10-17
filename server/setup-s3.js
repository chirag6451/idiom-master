import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'idioms';

async function setupS3() {
  try {
    // Check if bucket exists
    console.log(`Checking if bucket "${BUCKET_NAME}" exists...`);
    
    try {
      await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
      console.log(`✅ Bucket "${BUCKET_NAME}" already exists!`);
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
        console.log(`❌ Bucket "${BUCKET_NAME}" does not exist. Creating...`);
        
        // Create bucket (without ACL due to BucketOwnerEnforced setting)
        await s3.createBucket({
          Bucket: BUCKET_NAME
        }).promise();
        
        console.log(`✅ Bucket "${BUCKET_NAME}" created successfully!`);
        
        // Set CORS configuration
        const corsParams = {
          Bucket: BUCKET_NAME,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
                AllowedOrigins: ['*'],
                ExposeHeaders: []
              }
            ]
          }
        };
        
        await s3.putBucketCors(corsParams).promise();
        console.log('✅ CORS configuration set!');
        
        // Set bucket policy for public read
        const policyParams = {
          Bucket: BUCKET_NAME,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
              }
            ]
          })
        };
        
        await s3.putBucketPolicy(policyParams).promise();
        console.log('✅ Public read policy set!');
      } else {
        throw error;
      }
    }
    
    // List buckets to verify
    const buckets = await s3.listBuckets().promise();
    console.log('\n📦 Your S3 Buckets:');
    buckets.Buckets.forEach(bucket => {
      console.log(`  - ${bucket.Name}`);
    });
    
    console.log('\n✅ S3 setup complete!');
    console.log(`\nBucket URL: https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`);
    
  } catch (error) {
    console.error('❌ Error setting up S3:', error.message);
    console.error('Full error:', error);
  }
}

setupS3();
