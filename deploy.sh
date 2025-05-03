#!/bin/bash
# Attendance Tracker - AWS Docker Deployment Script

# Exit immediately if a command exits with a non-zero status
set -e

# Set default values
AWS_REGION="us-east-1"
ECR_REPOSITORY_NAME="attendance-tracker"
IMAGE_TAG="latest"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install it first."
    exit 1
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --region)
        AWS_REGION="$2"
        shift
        shift
        ;;
        --repository)
        ECR_REPOSITORY_NAME="$2"
        shift
        shift
        ;;
        --tag)
        IMAGE_TAG="$2"
        shift
        shift
        ;;
        *)
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
done

# Get AWS account ID
echo "Getting AWS account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Failed to get AWS account ID. Please check your AWS credentials."
    exit 1
fi

echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "ECR Repository Name: $ECR_REPOSITORY_NAME"
echo "Image Tag: $IMAGE_TAG"

# Check if repository exists, create if not
echo "Checking if ECR repository exists..."
if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY_NAME --region $AWS_REGION &> /dev/null; then
    echo "ECR repository does not exist. Creating it..."
    aws ecr create-repository --repository-name $ECR_REPOSITORY_NAME --region $AWS_REGION
else
    echo "ECR repository already exists."
fi

# Get ECR login token and authenticate Docker
echo "Authenticating Docker with ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
echo "Building Docker image..."
docker build -t $ECR_REPOSITORY_NAME:$IMAGE_TAG .

# Tag Docker image
echo "Tagging Docker image..."
docker tag $ECR_REPOSITORY_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG

# Push Docker image to ECR
echo "Pushing Docker image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG

# Update task definition with the new image URI
echo "Updating task definition..."
sed -i "s|ACCOUNT_ID|$AWS_ACCOUNT_ID|g" aws-task-definition.json
sed -i "s|REGION|$AWS_REGION|g" aws-task-definition.json

echo "Deployment preparation complete!"
echo "Image URI: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG"
echo ""
echo "Next steps:"
echo "1. Register the task definition: aws ecs register-task-definition --cli-input-json file://aws-task-definition.json"
echo "2. Update the ECS service: aws ecs update-service --cluster attendance-tracker-cluster --service attendance-tracker-service --force-new-deployment"
echo ""
echo "Or deploy using CloudFormation:"
echo "aws cloudformation deploy --template-file cloudformation-template.yaml --stack-name attendance-tracker --parameter-overrides ContainerImage=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG EnvironmentName=prod --capabilities CAPABILITY_IAM"
