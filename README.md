# Habify Backend

This is the backend service for the Habify mobile application, built using NestJS (TypeScript).
This guide is designed so that anyone cloning the repository for the first time can run the backend without asking questions.

⸻
 1. Requirements

Make sure the following tools are installed on your machine:
	•	Node.js 20+
	•	npm 10+
	•	Git

Check your versions:

node -v
npm -v

⸻

2. Clone the Repository

git clone https://github.com/ctis-habify/habify-backend.git
cd habify-backend

⸻

3. Install Dependencies

npm install

This command installs NestJS, testing libraries, formatters, and Git hook tools.
⸻

4. Run the Backend

Start the server in development mode:

npm run start:dev

If successful, you will see:

Nest application successfully started

The backend will be available at:

http://localhost:3000

⸻

5. Available Test Endpoints

Use the URLs below to verify that the backend is running properly:
	•	Auth:
http://localhost:3000/auth/health
	•	Users:
http://localhost:3000/users
	•	Routines:
http://localhost:3000/routines

If these return JSON responses, the server is working correctly.

⸻

6. Code Quality Tools

Run linting

npm run lint

Automatically fix issues

npm run lint:fix

Format code using Prettier

npm run format


⸻

7. Git Hooks (Husky)

This project uses Husky to enforce code standards before commits.

✔ Pre-commit Hook
	•	Runs ESLint + Prettier on staged files
	•	Rejects commits with lint or formatting issues

✔ Commit-msg Hook
	•	Enforces Conventional Commit message format
	•	Valid examples:

feat: add new feature
fix: resolve bug
refactor: improve code structure
chore: update config

If the message format is invalid, the commit will be rejected.

⸻

8. Production Build

npm run build
npm run start:prod


⸻

9. Contributing
	1.	Create a feature branch: git checkout -b your-name/new-feature
	2.	Make your changes.
	3.	Commit your work (Husky will run checks automatically).
	4.	Push your branch and open a Pull Request.

⸻

10. Common Issues & Fixes

!!! husky - not a git repository

git init
npm run prepare

!!! Commit rejected due to linting

npm run lint:fix
git add .
git commit -m "fix: lint issues"

!!! Commit rejected due to invalid commit message

Correct format example:

feat: implement routine creation


⸻

🎉 That’s it!
The backend should now be fully installed and running.
Happy coding! 🚀
