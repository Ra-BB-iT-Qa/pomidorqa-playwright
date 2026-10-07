import { Locator, Page } from "@playwright/test";
import { ROUTES } from "../helpers/user";

export class HeaderPage {
    page: Page;
    root: Locator;
    guestLoginLink: Locator;
    memberSlotsLink: Locator;
    memberMeetingsLink: Locator;
    memberProfileLink: Locator;
    logoutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByTestId("PomidorqaHeader-header");
        this.guestLoginLink = page.getByTestId("PomidorqaHeader-login-link");
        this.memberSlotsLink = page.getByTestId("PomidorqaHeader-slots-link");
        this.memberMeetingsLink = page.getByTestId("PomidorqaHeader-bookings-link");
        this.memberProfileLink = page.getByTestId("PomidorqaHeader-profile-link");
        this.logoutButton = page.getByTestId("PomidorqaHeader-logout-button");
    }

    async logout() {
        const loggedOut = this.page.waitForResponse(
            (response) =>
                response.url().endsWith(ROUTES.pomidorqa) && response.request().method() === "POST"
        );
        await this.logoutButton.click();
        await loggedOut;
    }

    async swipeLeft() {
        const viewport = this.page.viewportSize();
        if (!viewport) {
            throw new Error("Для слайда нужен размер окна");
        }
        const y = 32;
        const startX = Math.round(viewport.width * 0.62);
        const endX = Math.round(viewport.width * 0.32);
        await this.page.mouse.move(startX, y);
        await this.page.mouse.down();
        await this.page.mouse.move(endX, y, { steps: 30 });
        await this.page.mouse.up();
        await this.page.goBack();
    }
}
