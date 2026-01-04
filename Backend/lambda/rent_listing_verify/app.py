import os
import json
import boto3
import requests
import logging
from datetime import datetime

# ---------- Logging setup ----------
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def log(obj, label=""):
    try:
        logger.info("%s %s", label, json.dumps(obj, default=str))
    except Exception:
        logger.info("%s %s", label, str(obj))

# ---------- DynamoDB ----------
TABLE_NAME = os.environ.get("TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# ---------- AWS Secrets Manager ----------
def get_openai_api_key():
    """
    Retrieve OpenAI API key from AWS Secrets Manager.
    """
    try:
        import boto3
        client = boto3.client('secretsmanager')
        secret_name = os.environ.get("LLM_SECRET_NAME", "containers-club-dev-llm-key")

        response = client.get_secret_value(SecretId=secret_name)
        secret_data = response.get('SecretString', '{}')

        import json
        secret_dict = json.loads(secret_data)
        return secret_dict.get('openai_api_key', '')

    except Exception as e:
        logger.error(f"Failed to retrieve OpenAI API key from Secrets Manager: {str(e)}")
        return ""

def analyze_image_with_llm(image_url):
    """
    Mock function to analyze image content using LLM.
    In production, this would call OpenAI Vision API.
    """
    try:
        # Mock analysis - in real implementation, this would:
        # 1. Download the image from S3
        # 2. Send to OpenAI Vision API with prompt to check for inappropriate content
        # 3. Return analysis results

        logger.info(f"Analyzing image: {image_url}")

        # Mock response - assume all images are appropriate for demo
        return {
            "is_appropriate": True,
            "content_type": "shipping_container",
            "confidence": 0.95
        }

    except Exception as e:
        logger.error(f"Error analyzing image {image_url}: {str(e)}")
        return {
            "is_appropriate": False,
            "error": str(e)
        }

def enhance_description_with_llm(title, current_description, specs, condition, size):
    """
    Mock function to enhance listing description using LLM.
    In production, this would call OpenAI API to generate better descriptions.
    """
    try:
        logger.info(f"Enhancing description for: {title}")

        # Mock enhancement - in real implementation, this would:
        # 1. Send current description to OpenAI
        # 2. Ask for enhancement with more details about container features
        # 3. Generate comprehensive rental terms

        # Enhanced description template
        enhanced_desc = f"""Premium {size} shipping container available for rent.

{current_description}

Key Features:
• Size: {size}
• Condition: {condition}
• Specifications: {specs or 'Standard shipping container specifications'}

Perfect for storage, warehousing, or construction site needs. Professionally maintained and inspected regularly."""

        # Enhanced rental terms
        rental_terms = """• Minimum rental period: 30 days
• Security deposit required (refundable upon return)
• Container must be returned in same condition
• Delivery and pickup available
• Insurance recommended for contents
• 24/7 access available
• Professional installation service included"""

        return {
            "enhanced_description": enhanced_desc,
            "rental_terms": rental_terms
        }

    except Exception as e:
        logger.error(f"Error enhancing description: {str(e)}")
        return {
            "enhanced_description": current_description,
            "rental_terms": "Standard rental terms apply. Please contact for details."
        }

def process_listing_verification(listing_id):
    """
    Main function to process a listing through LLM verification.
    """
    try:
        logger.info(f"Processing listing verification for: {listing_id}")

        # 1. Get the listing from DynamoDB
        response = table.get_item(Key={"listingId": listing_id})
        if "Item" not in response:
            logger.error(f"Listing not found: {listing_id}")
            return False

        listing = response["Item"]
        log(listing, "LISTING TO VERIFY:")

        # 2. Analyze images for inappropriate content
        image_analysis_results = []
        if listing.get("images"):
            for image_url in listing["images"]:
                analysis = analyze_image_with_llm(image_url)
                image_analysis_results.append(analysis)

                if not analysis.get("is_appropriate", False):
                    logger.warning(f"Inappropriate content detected in image: {image_url}")
                    # Mark as rejected
                    table.update_item(
                        Key={"listingId": listing_id},
                        UpdateExpression="SET #status = :status, verificationNotes = :notes",
                        ExpressionAttributeNames={"#status": "status"},
                        ExpressionAttributeValues={
                            ":status": "rejected",
                            ":notes": "Inappropriate content detected in images"
                        }
                    )
                    return False

        # 3. Enhance description and generate rental terms
        enhancement = enhance_description_with_llm(
            listing.get("title", ""),
            listing.get("description", ""),
            listing.get("specs", ""),
            listing.get("condition", ""),
            listing.get("size", "")
        )

        # 4. Update listing with enhanced content and mark as active
        update_expression = "SET #status = :status, description = :description, rentalTerms = :rentalTerms, verifiedAt = :verifiedAt"
        expression_attribute_values = {
            ":status": "active",
            ":description": enhancement["enhanced_description"],
            ":rentalTerms": enhancement["rental_terms"],
            ":verifiedAt": datetime.utcnow().isoformat() + "Z"
        }

        table.update_item(
            Key={"listingId": listing_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ExpressionAttributeNames={"#status": "status"}
        )

        logger.info(f"Successfully verified and activated listing: {listing_id}")
        return True

    except Exception as e:
        logger.exception(f"Error processing listing verification for {listing_id}")
        # Mark as failed
        try:
            table.update_item(
                Key={"listingId": listing_id},
                UpdateExpression="SET #status = :status, verificationNotes = :notes",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": "verification_failed",
                    ":notes": f"Verification failed: {str(e)}"
                }
            )
        except Exception as update_error:
            logger.error(f"Failed to update listing status: {str(update_error)}")
        return False

def handler(event, context):
    """
    Lambda handler for DynamoDB stream events.
    Triggers when new listings are created with status "llm_review".
    """
    logger.info("===== LISTING VERIFICATION HANDLER START =====")
    log(event, "DYNAMODB STREAM EVENT:")

    processed_count = 0
    success_count = 0

    try:
        # Process DynamoDB stream records
        for record in event.get("Records", []):
            if record.get("eventName") == "INSERT":
                new_image = record.get("dynamodb", {}).get("NewImage", {})

                # Convert DynamoDB format to regular dict
                listing = {}
                for key, value in new_image.items():
                    if "S" in value:
                        listing[key] = value["S"]
                    elif "N" in value:
                        listing[key] = value["N"]
                    elif "BOOL" in value:
                        listing[key] = value["BOOL"]
                    elif "L" in value:
                        listing[key] = [item.get("S", "") for item in value["L"]]

                # Check if this is a new listing that needs verification
                if listing.get("status") == "llm_review":
                    processed_count += 1
                    listing_id = listing.get("listingId")

                    if listing_id:
                        if process_listing_verification(listing_id):
                            success_count += 1
                        else:
                            logger.error(f"Failed to verify listing: {listing_id}")

        logger.info(f"Processed {processed_count} listings, {success_count} successful")

    except Exception as e:
        logger.exception("Error processing DynamoDB stream")
        raise e

    return {
        "statusCode": 200,
        "body": json.dumps({
            "processed": processed_count,
            "successful": success_count
        })
    }
