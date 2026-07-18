Building a centralized GitHub App is the gold standard for creating production-ready bots. Unlike GitHub Actions, which runs locally within one repository, a GitHub App can be installed across hundreds of different repositories and organizations instantly. [1, 2]
Since the bot needs to be a "living" service that reacts to GitHub immediately, we will build a modern FastAPI (Python) server that handles incoming webhooks and connects securely to GitHub and OpenAI. [3, 4, 5]

---

## Phase 1: Create and Configure the GitHub App

1.  Navigate to App Registration: Go to your personal GitHub Settings > Developer Settings > GitHub Apps > Click New GitHub App. [6, 7, 8, 9, 10]
2.  Basic Settings:

- GitHub App Name: Choose a unique name (e.g., ai-maintainer-assistant).
  - Homepage URL: Enter your website or repository URL. [11, 12, 13, 14]

3.  Webhook Settings:

- Check Active.
  - Webhook URL: Enter your server's public endpoint (e.g., https://your-domain.com). For local testing, use a tool like Ngrok or loophole.
  - Webhook Secret: Create a strong, random password string. Save this. [15, 16, 17, 18]

4.  Permissions: Scroll down to Repository Permissions and adjust:

- Issues: Set to Read & Write.
  - Metadata: Set to Read-only (automatically selected by GitHub). [19, 20]

5.  Subscribe to Events: Under the permissions list, check the box for Issues. [21, 22]
6.  Save & Download Key: Click Create GitHub App.

- On the landing page, scroll down to Private keys and click Generate a private key.
  - A .pem file will download automatically. Move this file safely into your project folder.
  - Note your App ID and Client ID listed at the top of your app settings page. [23, 24, 25, 26, 27]

---

## Phase 2: Set Up Your Project Environment

Create a clean directory for your project, install the necessary dependencies, and add your environment variables. [28, 29, 30]

## 1. Dependencies (requirements.txt)

fastapi>=0.110.0
uvicorn>=0.28.0
pyjwt>=2.8.0
requests>=2.31.0
openai>=1.14.0
python-dotenv>=1.0.1

## 2. Configuration (.env)

Create a file named .env in your root folder. [31, 32]

GITHUB_APP_ID="123456" # Replace with your App ID
GITHUB_WEBHOOK_SECRET="your_secret_here" # Replace with your Webhook Secret
PRIVATE_KEY_PATH="./your-app-key.pem" # Path to your downloaded .pem file
OPENAI_API_KEY="sk-proj-..." # Your OpenAI API Key

---

## Phase 3: Write the Live Webhook Server

This FastAPI server will authenticate securely using your Private Key, calculate short-lived access tokens dynamically for the target repository, run OpenAI, and update the target GitHub issue. [33, 34]
Create a file named main.py: [35]

import osimport timeimport jsonimport hmacimport hashlibimport jwtimport requestsfrom fastapi import FastAPI, Request, HTTPException, BackgroundTasksfrom openai import OpenAIfrom dotenv import load_dotenv

load_dotenv()
app = FastAPI()openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Load configurationsAPP_ID = os.environ.get("GITHUB_APP_ID")WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET").encode('utf-8')PRIVATE_KEY_PATH = os.environ.get("PRIVATE_KEY_PATH")

with open(PRIVATE_KEY_PATH, "r") as f:
PRIVATE_KEY = f.read()
def generate_jwt() -> str:
"""Generates a JSON Web Token signed with the App's private key to authenticate to GitHub."""
payload = {
"iat": int(time.time()) - 60,
"exp": int(time.time()) + (10 \* 60), # Valid for 10 minutes max
"iss": APP_ID
}
return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")
def get_installation_access_token(installation_id: int) -> str:
"""Swaps the global App JWT for a temporary, repository-specific access token."""
jwt_token = generate_jwt()
url = f"https://github.com{installation_id}/access_tokens"
headers = {
"Authorization": f"Bearer {jwt_token}",
"Accept": "application/vnd.github+json"
}
response = requests.post(url, headers=headers)
response.raise_for_status()
return response.json()["token"]
def verify_signature(payload: bytes, signature: str) -> bool:
"""Secures your webhook endpoint by validating that incoming traffic originates strictly from GitHub."""
if not signature:
return False
sha_name, signature_val = signature.split('=')
if sha_name != 'sha256':
return False
mac = hmac.new(WEBHOOK_SECRET, msg=payload, digestmod=hashlib.sha256)
return hmac.compare_digest(mac.hexdigest(), signature_val)
def process_issue(payload: dict, token: str):
"""Executes AI classification and writes changes back to GitHub asynchronously."""
issue = payload["issue"]
repo = payload["repository"]

    owner = repo["owner"]["login"]
    repo_name = repo["name"]
    issue_number = issue["number"]

    # 1. Ask OpenAI for Structured Labels and Comments
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Analyze the GitHub issue. Provide a polite markdown reply and select exactly one accurate label from: ['bug', 'documentation', 'question']."
                },
                {"role": "user", "content": f"Title: {issue['title']}\nBody: {issue['body']}"}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "issue_response",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "reply": {"type": "string"},
                            "label": {"type": "string", "enum": ["bug", "documentation", "question"]}
                        },
                        "required": ["reply", "label"],
                        "additionalProperties": False
                    }
                }
            }
        )

        result = json.loads(completion.choices.message.content)
        ai_reply = result["reply"]
        label = result["label"]

        # 2. Setup GitHub API Headers with our dynamic installation token
        github_headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json"
        }

        # 3. Post the AI Response Comment
        comment_url = f"https://github.com{owner}/{repo_name}/issues/{issue_number}/comments"
        comment_body = {"body": f"{ai_reply}\n\n---\n*🤖 Bot triage: Tagged as **{label}***"}
        requests.post(comment_url, headers=github_headers, json=comment_body)

        # 4. Apply the Label
        label_url = f"https://github.com{owner}/{repo_name}/issues/{issue_number}/labels"
        requests.post(label_url, headers=github_headers, json={"labels": [label]})

        print(f"Successfully processed issue #{issue_number} in {owner}/{repo_name}")

    except Exception as e:
        print(f"Error handling issue: {e}")

@app.post("/webhook")async def github_webhook(request: Request, background_tasks: BackgroundTasks): # Read raw body bytes for cryptographic signature verification
body = await request.body()
signature = request.headers.get("X-Hub-Signature-256")

    if not verify_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = json.loads(body)
    event_type = request.headers.get("X-GitHub-Event")

    # Check if a brand-new issue was opened
    if event_type == "issues" and payload.get("action") == "opened":
        installation_id = payload["installation"]["id"]

        # Get a temporary token for this specific repository ecosystem
        token = get_installation_access_token(installation_id)

        # Offload AI generation to a background task so GitHub's connection doesn't time out
        background_tasks.add_task(process_issue, payload, token)
        return {"status": "Processing issue event in background"}

    return {"status": "Event ignored"}

---

## Phase 4: Deploy and Run## Local Testing

1.  Install dependencies: pip install -r requirements.txt
2.  Run your server locally: uvicorn main:app --port 8000
3.  Expose your server to the internet using ngrok: ngrok http 8000
4.  Copy the https://... URL provided by ngrok and paste it as your Webhook URL inside your GitHub App settings page. [36, 37, 38, 39, 40]

## Production Deployment

## You can deploy this script to platforms like Render, Railway, or a standard VPS. Simply map the variables from your .env file into their environmental dashboard management panel and ensure your .pem key file is securely read by the script. [41, 42]

## Phase 5: Installation

1.  Go back to your GitHub App settings page.
2.  Select Install App in the left sidebar configuration menu.
3.  Click Install next to your user account or targeted organization.
4.  Choose whether to install it globally on All repositories or on a Select repository basis. [43, 44, 45, 46, 47]

Now, whenever anyone drops a new issue into any repository running your App, your dedicated bot account will spring into life, comment, and label it within seconds!
Would you like to explore how to extend this App to listen for Pull Requests to review code, or do you need help configuring a Dockerfile to deploy the server?

[1] [https://jasonet.co](https://jasonet.co/posts/probot-app-or-github-action-v2/)
[2] [https://josh-ops.com](https://josh-ops.com/posts/github-enterprise-apps/)
[3] [https://jorisbaan.nl](https://jorisbaan.nl/2025/01/14/ai-chat-app-from-scratch-part-1.html)
[4] [https://community.latenode.com](https://community.latenode.com/t/running-telegram-bot-alongside-fastapi-server-in-single-python-application/26622)
[5] [https://www.youtube.com](https://www.youtube.com/watch?v=By7BQgsUsnI)
[6] [https://github-app-tutorial.readthedocs.io](https://github-app-tutorial.readthedocs.io/en/latest/creating-github-app.html)
[7] [https://docs.quarkiverse.io](https://docs.quarkiverse.io/quarkus-github-app/dev/register-github-app.html)
[8] [https://techdocs.broadcom.com](https://techdocs.broadcom.com/us/en/ca-mainframe-software/devops/endevor-bridge-for-git/2-0/installing/set-up-git-server-communication/authentication-methods/create-and-install-the-github-app.html)
[9] [https://www.linkedin.com](https://www.linkedin.com/pulse/how-we-built-github-app-level-up-our-ci-pipeline-arach-tchoupani)
[10] [https://oneuptime.com](https://oneuptime.com/docs/en/self-hosted/github-integration)
[11] [https://pipelinesascode.com](https://pipelinesascode.com/docs/getting-started/)
[12] [https://docs.github.com](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
[13] [https://developers.plane.so](https://developers.plane.so/self-hosting/govern/integrations/github)
[14] [https://nango.dev](https://nango.dev/docs/api-integrations/github-app-oauth/how-to-register-your-own-github-app-api-oauth-app)
[15] [https://docs.catalyst.zoho.com](https://docs.catalyst.zoho.com/en/tutorials/githubbot/java/configure-bot/)
[16] [https://docs.langchain.com](https://docs.langchain.com/langsmith/prompt-commit)
[17] [https://www.linkedin.com](https://www.linkedin.com/pulse/how-integrate-ai-powered-chatbots-laravel-rgtdf)
[18] [https://github.com](https://github.com/github/docs/blob/main/content/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps.md)
[19] [https://akpolatcem.medium.com](https://akpolatcem.medium.com/building-your-first-github-app-from-hello-world-to-production-ready-bot-6795c3d43f28)
[20] [https://learn.microsoft.com](https://learn.microsoft.com/en-us/azure/sre-agent/setup-github-byo-app)
[21] [https://www.anyscale.com](https://www.anyscale.com/blog/building-an-llm-powered-github-bot-to-improve-your-pull-requests)
[22] [https://appwrite.io](https://appwrite.io/integrations/deployments-github)
[23] [https://code.claude.com](https://code.claude.com/docs/en/github-actions)
[24] [https://docs.quarkiverse.io](https://docs.quarkiverse.io/quarkus-github-app/dev/register-github-app.html)
[25] [https://github.com](https://github.com/sbdchd/squawk/blob/master/docs/docs/github_app.md)
[26] [https://docs.cloudposse.com](https://docs.cloudposse.com/layers/software-delivery/eks-argocd/tutorials/github-apps/)
[27] [https://dev.to](https://dev.to/jajera/how-to-create-a-github-app-for-atlantis-1oe9)
[28] [https://medium.com](https://medium.com/@nikhilsamant4/automate-your-code-reviews-how-i-developed-an-ai-driven-github-application-to-perform-code-review-4071ab0b800a)
[29] [https://www.assemblyai.com](https://www.assemblyai.com/blog/build-a-free-stable-diffusion-app-with-a-gpu-backend)
[30] [https://www.pingcap.com](https://www.pingcap.com/article/building-a-retrieval-augmented-generation-application-with-llamaindex-and-mysql-compatible-database/)
[31] [https://adventuremedia.ai](https://adventuremedia.ai/blog/how-to-build-a-lead-generation-bot-with-claude-code-complete-tutorial)
[32] [https://medium.com](https://medium.com/china-software-development/build-your-wechat-chatbot-6e439d3c9650)
[33] [https://levelup.gitconnected.com](https://levelup.gitconnected.com/building-a-telegram-app-in-python-with-fastapi-webhook-python-telegram-bot-5f19dca2ebb7)
[34] [https://docs.airtop.ai](https://docs.airtop.ai/guides/integrations/make)
[35] [https://www.honeybadger.io](https://www.honeybadger.io/blog/flask-github-actions-continuous-delivery/)
[36] [https://medium.com](https://medium.com/kocsistem/make-your-own-python-pip-package-69e28478c5da)
[37] [https://shwinda.medium.com](https://shwinda.medium.com/build-a-full-stack-llm-application-with-openai-flask-react-and-pinecone-part-1-f3844429a5ef)
[38] [https://www.youtube.com](https://www.youtube.com/watch?v=7ud6xF5zMlY)
[39] [https://www.digitalregenesys.com](https://www.digitalregenesys.com/blog/what-is-github)
[40] [https://github.com](https://github.com/kleenkanteen/ai-project-manager-assistant)
[41] [https://dev.to](https://dev.to/udara_dananjaya/complete-guide-automating-deployment-with-github-webhooks-nginx-and-shell-scripts-gp0)
[42] [https://trigger.dev](https://trigger.dev/blog/scrape-hacker-news)
[43] [https://dev.to](https://dev.to/alishirani/how-i-made-github-issues-hilarious-build-your-own-github-bot-4fj)
[44] [https://github.com](https://github.com/godaddy/pullie)
[45] [https://docs.cloudbees.com](https://docs.cloudbees.com/docs/cloudbees-ci/latest/cloud-admin-guide/github-app-auth)
[46] [https://docs.posit.co](https://docs.posit.co/rspm/admin/building-packages.html)
[47] [https://staragile.com](https://staragile.com/blog/what-is-github)
