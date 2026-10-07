import { Locator, Page } from "@playwright/test";
import { ROUTES, type TestUser } from "../helpers/user";

export class RegisterPage {
    page: Page;
    heading: Locator;
    nameInput: Locator;
    emailInput: Locator;
    passwordInput: Locator;
    submitButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole("heading", { name: "Регистрация в PomidorQA" });
        this.nameInput = page.getByLabel("Имя");
        this.emailInput = page.getByLabel("Email");
        this.passwordInput = page.getByLabel("Пароль");
        this.submitButton = page.getByRole("button", { name: "Зарегистрироваться" });
    }

    async open() {
        await this.page.goto(ROUTES.register);
    }

    async register(fields: Partial<Pick<TestUser, "name" | "email" | "password">>) {
        if (fields.name !== undefined) {
            await this.nameInput.fill(fields.name);
        }
        if (fields.email !== undefined) {
            await this.emailInput.fill(fields.email);
        }
        if (fields.password !== undefined) {
            await this.passwordInput.fill(fields.password);
        }
        await this.submitButton.click();
    }

    async registerAccount(user: Pick<TestUser, "name" | "email" | "password">) {
        const submitted = this.page.waitForResponse(
            (response) =>
                response.url().endsWith(ROUTES.register) && response.request().method() === "POST"
        );
        await this.register(user);
        await submitted;
    }

    isValueMissing(field: Locator) {
        return field.evaluate((element) => {
            const input = element as { validity: { valueMissing: boolean } };
            return input.validity.valueMissing;
        });
    }

    isTypeMismatch(field: Locator) {
        return field.evaluate((element) => {
            const input = element as { validity: { typeMismatch: boolean } };
            return input.validity.typeMismatch;
        });
    }
}
