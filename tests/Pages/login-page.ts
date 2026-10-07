import { Locator, Page } from "@playwright/test";
import { ROUTES, type TestUser } from "../helpers/user";

export class LoginPage {
    page: Page;
    heading: Locator;
    emailInput: Locator;
    passwordInput: Locator;
    submitButton: Locator;
    error: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole("heading", { name: "Вход в PomidorQA" });
        this.emailInput = page.getByLabel("Email");
        this.passwordInput = page.getByLabel("Пароль");
        this.submitButton = page.getByRole("button", { name: "Войти" });
        this.error = page.getByRole("alert").filter({ hasText: "Неверный email или пароль" });
    }

    async open() {
        await this.page.goto(ROUTES.login);
    }

    async submit(credentials: Partial<Pick<TestUser, "email" | "password">> = {}) {
        if (credentials.email !== undefined) {
            await this.emailInput.fill(credentials.email);
        }
        if (credentials.password !== undefined) {
            await this.passwordInput.fill(credentials.password);
        }
        await this.submitButton.click();
    }

    async login(credentials: Pick<TestUser, "email" | "password">) {
        const submitted = this.page.waitForResponse(
            (response) =>
                response.url().endsWith(ROUTES.login) && response.request().method() === "POST"
        );
        await this.submit(credentials);
        await submitted;
    }

    isValueMissing(field: Locator) {
        return field.evaluate((element) => {
            const input = element as { validity: { valueMissing: boolean } };
            return input.validity.valueMissing;
        });
    }
}
