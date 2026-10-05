import { Locator, Page } from "@playwright/test";
import { ROUTES, type TestUser } from "../helpers/user";

export class LoginPage {
    page: Page;
    emailInput: Locator;
    passwordInput: Locator;
    submitButton: Locator;
    error: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.getByLabel("Email");
        this.passwordInput = page.getByLabel("Пароль");
        this.submitButton = page.getByRole("button", { name: "Войти" });
        this.error = page.getByRole("alert").filter({ hasText: "Неверный email или пароль" });
    }

    async open() {
        await this.page.goto(ROUTES.login);
    }

    async login(credentials: Pick<TestUser, "email" | "password">) {
        const submitted = this.page.waitForResponse(
            (response) =>
                response.url().endsWith(ROUTES.login) && response.request().method() === "POST"
        );
        await this.emailInput.fill(credentials.email);
        await this.passwordInput.fill(credentials.password);
        await this.submitButton.click();
        await submitted;
    }
}
