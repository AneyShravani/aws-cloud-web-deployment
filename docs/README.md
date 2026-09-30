# AWS Cloud Web Deployment

A cloud deployment project demonstrating the deployment of a web application on AWS using EC2, S3, IAM, and Linux. The project focuses on cloud infrastructure, application hosting, storage, access control, and basic security configuration.

## Technologies Used

* AWS EC2 — Application hosting
* AWS S3 — Object storage
* AWS IAM — Identity and access management
* Linux — Server environment
* Git & GitHub — Version control
* Web Application — Application deployed on AWS

## Project Overview

The application is deployed on an AWS EC2 instance running Linux. The deployment includes configuring the server environment, managing application files, configuring access permissions, and connecting cloud storage using Amazon S3.

The project provides hands-on experience with AWS infrastructure and Linux-based application deployment.

## Key Features

* Web application deployment on AWS EC2
* Linux server configuration and application hosting
* Amazon S3 integration for object storage
* IAM-based access management
* EC2 security group configuration
* Git-based source code management
* Basic deployment troubleshooting and system monitoring

## Architecture

```text
                 ┌─────────────────┐
                 │    Web Client   │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │   AWS EC2       │
                 │  Linux Server   │
                 │ Web Application │
                 └───────┬─────────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      ┌─────────────┐        ┌─────────────┐
      │    AWS S3   │        │  AWS IAM    │
      │ Object Store│        │ Access Ctrl │
      └─────────────┘        └─────────────┘
```

## Deployment Workflow

1. Create and configure an AWS EC2 instance.
2. Set up the Linux environment required by the application.
3. Configure EC2 security group rules.
4. Transfer or clone the application source code.
5. Configure and run the application on the EC2 server.
6. Configure an S3 bucket for object storage.
7. Configure IAM permissions for required AWS resources.
8. Test application accessibility and cloud resource connectivity.
9. Document deployment and troubleshooting steps.

## Security

* EC2 access is controlled through security group rules.
* AWS resources are accessed using IAM permissions.
* Credentials and sensitive configuration values are kept outside the source code.
* AWS access keys and secrets are not committed to GitHub.

## Repository Structure

```text
aws-cloud-web-deployment/
├── app/
├── deployment/
├── architecture/
├── screenshots/
└── README.md
```

## Learning Outcomes

* AWS EC2-based application deployment
* Linux server administration
* AWS S3 object storage
* IAM and access management
* Cloud security fundamentals
* Git-based deployment workflow
* Basic cloud troubleshooting

## Future Enhancements

* AWS CloudWatch monitoring
* CI/CD-based deployment
* Docker containerization
* Terraform-based infrastructure provisioning
* Load balancing and auto scaling
