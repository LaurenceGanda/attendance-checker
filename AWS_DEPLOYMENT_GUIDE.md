# Attendance Tracker - AWS Deployment Guide with Docker

This guide provides step-by-step instructions for deploying the Attendance Tracker application to AWS using Docker containers and various AWS services.

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Docker installed on your local machine
- Git repository for your application

## Step 1: Install and Configure AWS CLI

```bash
# Install AWS CLI (if not already installed)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI with your credentials
aws configure
```

## Step 2: Build and Test the Docker Image Locally

```bash
# Build Docker image
docker build -t attendance-tracker .

# Run the container locally to test
docker run -p 8080:80 attendance-tracker
```

Visit http://localhost:8080 to verify the application is working correctly.

## Step 3: Create Amazon ECR Repository

```bash
aws ecr create-repository --repository-name attendance-tracker --region your-region
```

## Step 4: Authenticate Docker to ECR

```bash
aws ecr get-login-password --region your-region | docker login --username AWS --password-stdin your-account-id.dkr.ecr.your-region.amazonaws.com
```

## Step 5: Tag and Push the Image to ECR

```bash
# Tag the image
docker tag attendance-tracker:latest your-account-id.dkr.ecr.your-region.amazonaws.com/attendance-tracker:latest

# Push the image to ECR
docker push your-account-id.dkr.ecr.your-region.amazonaws.com/attendance-tracker:latest
```

## Step 6: Create an ECS Cluster (AWS Fargate)

```bash
aws ecs create-cluster --cluster-name attendance-tracker-cluster
```

## Step 7: Set Up IAM Roles

Create an IAM role for ECS task execution:

```bash
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-task-execution-role.json

aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

Create the ecs-task-execution-role.json file with the following content:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Step 8: Update the Task Definition

Edit the aws-task-definition.json file in this project:

1. Replace `ACCOUNT_ID` with your AWS Account ID
2. Replace `REGION` with your AWS region

Then register the task definition:

```bash
aws ecs register-task-definition --cli-input-json file://aws-task-definition.json
```

## Step 9: Create a Security Group

```bash
# Create a security group
aws ec2 create-security-group --group-name attendance-tracker-sg --description "Security group for Attendance Tracker" --vpc-id your-vpc-id

# Add inbound rule for HTTP
aws ec2 authorize-security-group-ingress --group-id your-security-group-id --protocol tcp --port 80 --cidr 0.0.0.0/0
```

## Step 10: Create an ECS Service

```bash
aws ecs create-service \
  --cluster attendance-tracker-cluster \
  --service-name attendance-tracker-service \
  --task-definition attendance-tracker:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[your-subnet-id-1,your-subnet-id-2],securityGroups=[your-security-group-id],assignPublicIp=ENABLED}"
```

## Step 11: Create an Application Load Balancer (Optional)

For a production environment, you may want to add an Application Load Balancer:

```bash
# Create a load balancer
aws elbv2 create-load-balancer --name attendance-tracker-lb --subnets your-subnet-id-1 your-subnet-id-2 --security-groups your-security-group-id

# Create a target group
aws elbv2 create-target-group --name attendance-tracker-tg --protocol HTTP --port 80 --vpc-id your-vpc-id --target-type ip --health-check-path / --health-check-interval-seconds 30 --health-check-timeout-seconds 5 --healthy-threshold-count 5 --unhealthy-threshold-count 2

# Create a listener
aws elbv2 create-listener --load-balancer-arn your-load-balancer-arn --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=your-target-group-arn
```

## Step 12: Update the ECS Service to use the Load Balancer

```bash
aws ecs update-service \
  --cluster attendance-tracker-cluster \
  --service attendance-tracker-service \
  --load-balancers "targetGroupArn=your-target-group-arn,containerName=attendance-tracker,containerPort=80"
```

## Step 13: Set Up Route 53 for a Custom Domain (Optional)

If you have a custom domain and want to use it:

```bash
aws route53 change-resource-record-sets --hosted-zone-id your-hosted-zone-id --change-batch file://route53-change-set.json
```

Create route53-change-set.json with the following content:

```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "attendance.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "your-elb-hosted-zone-id",
          "DNSName": "your-load-balancer-dns-name",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
```

## Step 14: Set Up CI/CD with GitHub Actions (Optional)

Create a .github/workflows/aws-deploy.yml file in your repository:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v2
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ secrets.AWS_REGION }}
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build, tag, and push image to Amazon ECR
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: attendance-tracker
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
    
    - name: Update ECS service
      run: |
        aws ecs update-service --cluster attendance-tracker-cluster --service attendance-tracker-service --force-new-deployment
```

## Step 15: Monitoring with CloudWatch

Set up CloudWatch monitoring and alarms:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name attendance-tracker-high-cpu \
  --alarm-description "Alarm when CPU exceeds 70%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 60 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=attendance-tracker-cluster Name=ServiceName,Value=attendance-tracker-service \
  --evaluation-periods 3 \
  --alarm-actions your-sns-topic-arn
```

## Cleanup Resources (When No Longer Needed)

```bash
# Delete the ECS service
aws ecs delete-service --cluster attendance-tracker-cluster --service attendance-tracker-service --force

# Delete the ECS cluster
aws ecs delete-cluster --cluster attendance-tracker-cluster

# Delete the ECR repository
aws ecr delete-repository --repository-name attendance-tracker --force

# Delete the load balancer and related resources (if created)
aws elbv2 delete-load-balancer --load-balancer-arn your-load-balancer-arn
aws elbv2 delete-target-group --target-group-arn your-target-group-arn

# Delete the security group
aws ec2 delete-security-group --group-id your-security-group-id
```

## Troubleshooting

1. **Container not starting**: Check the CloudWatch logs for errors:
   ```bash
   aws logs get-log-events --log-group-name /ecs/attendance-tracker --log-stream-name your-log-stream
   ```

2. **Application not accessible**: Verify security group settings and network configuration.

3. **Image not found**: Ensure the ECR repository path is correct in the task definition.

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [Docker Documentation](https://docs.docker.com/)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
