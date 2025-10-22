# Frontend

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.16.

# Angular Project - Development Environment Setup

## Development Environment Requirements

To set up the development environment for this Angular project, ensure you have the following installed:

- **Angular CLI:** 16.2.16
- **Node.js:** Version 22.14.0 
- **npm:** 10.9.2

---

### How to Set Up and Run the Frontend

### 1. Install Node.js and npm
Go to: https://nodejs.org/en/download/   

Version :  22.14.0 

Click the big button for the LTS version and download the installer.

Run the installer and keep clicking "Next" until it's finished.

After installation, check it's working:

Open the Command Prompt (search "cmd" on Windows).

node -v
npm -v
You should see two version numbers. (If you get an error, repeat the installation.)

### 2. Install Angular CLI

Install the specific Angular CLI version globally using npm: 
In the Command Prompt, type:

npm install -g @angular/cli@16.2.16


### Verify the installation and the Angular version by running:

ng version

---
## Running the Angular Project Locally

1. **Open your project folder in the vs code**  
Navigate to your project directory,
eg: cd your-project-folder  or cd frontend

2. **Install project dependencies**  
Install all required packages from `package.json` by running:

npm install

3. **Run the Angular development server**

Start the development server and open the app in your default browser:

ng serve -o

The application will be available at:

http://localhost:4200/









## Development server

Run `ng serve`   for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


### folder structure 
Frontend/
│
├── dist/
│   - Contains optimized production build files, generated after you run `ng build`.
│
├── node_modules/
│   - Stores project dependencies installed via npm. Auto-generated; do not edit manually.
│
├── src/
│   ├── app/
│   │    ├── core/services/
│   │    │    - chat.service.ts: Service file for chat logic, reusable across components.
│   │    │    - chat.service.spec.ts: Test file for the chat service.
│   │    ├── app-routing.module.ts: Handles Angular app routing.
│   │    ├── app.component.css: Styles for the root app component.
│   │    ├── app.component.html: Template for the root app component.
│   │    ├── app.component.ts: TypeScript logic for the root app component.
│   │    ├── app.component.spec.ts: Unit tests for the root app component.
│   │    ├── app.module.ts: Main module file of your Angular application.
│   │
│   ├── assets/
│   │    - Folder for static assets like images, fonts, or other files used in the app.
│   │
│   ├── environments/
│   │    - environment.ts: Configuration for development environment variables.
│   │    - environment.prod.ts: Configuration for production environment variables.
│   │
│   ├── favicon.ico: Icon for the browser tab.
│   ├── index.html: Main entry HTML file of the application.
│   ├── main.ts: Bootstraps and starts the Angular app.
│   ├── proxy.conf.json: Proxy configuration (useful for API requests in development).
│   ├── styles.css: Global styles for your Angular app.
│
├── .editorconfig: Editor configuration rules for coding consistency.
├── .gitignore: List of files/folders to exclude from Git version control.
├── angular.json: Angular CLI configuration file for project settings.
├── package-lock.json: Auto-generated lock file to ensure consistent dependency installation.
├── package.json: Lists dependencies, scripts, and general project info for npm.
├── README.md: Project documentation and setup instructions.
├── tsconfig.app.json: TypeScript config specific for the Angular application.
├── tsconfig.json: Global TypeScript configuration file.
