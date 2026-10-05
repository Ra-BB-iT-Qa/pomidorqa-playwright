import { Locator, Page } from "@playwright/test";
import { ROUTES } from "../helpers/user";

export class BookingPage {
    page: Page;
    catalogHeading: Locator;
    catalogFilterInput: Locator;
    catalogFilterSubmit: Locator;
    catalogCard: Locator;
    slotDays: Locator;
    slotTimes: Locator;
    slotTimezoneNote: Locator;
    personName: Locator;
    bookingDialog: Locator;
    bookingConfirmButton: Locator;
    bookingConfirmSuccess: Locator;
    bookingConfirmError: Locator;
    bookingCloseButton: Locator;
    bookingsUpcomingSection: Locator;
    bookingsPastSection: Locator;
    bookingsCard: Locator;
    bookingsCardName: Locator;
    bookingsCardCancelButton: Locator;
    bookingsPastCard: Locator;
    bookingsPastCardName: Locator;
    bookingCancelError: Locator;

    constructor(page: Page) {
        this.page = page;
        this.catalogHeading = page.getByRole("heading", { name: "Найти собеседника" });
        this.catalogFilterInput = page.locator('#pomidorqa-catalog-skill-filter');
        this.catalogFilterSubmit = page.getByRole('button', {name: 'Найти'});
        this.catalogCard = page.getByTestId("person-card");
        this.slotDays = page.getByRole("group", { name: "Дни со слотами" }).getByRole("button");
        this.slotTimes = page.getByRole("group", { name: "Время слотов" }).getByRole("button");
        this.slotTimezoneNote = page.getByText("Время в часовом поясе участника");
        this.personName = page.getByRole("heading", {level: 1});
        this.bookingDialog = page.getByRole("dialog");
        this.bookingConfirmButton = page.getByRole("button", { name: "Подтвердить" });
        this.bookingConfirmSuccess = page.getByRole("dialog").getByRole("status");
        this.bookingConfirmError = page.getByRole("dialog").getByRole("alert");
        this.bookingCloseButton = page.getByRole("dialog").getByRole("button", { name: "Закрыть" });
        this.bookingsUpcomingSection = page.getByTestId("upcoming-meetings");
        this.bookingsPastSection = page.locator("section").filter({
            has: page.getByRole("heading", { name: "Прошедшие и отменённые" }),
        });
        this.bookingsCard = this.bookingsUpcomingSection.locator("[data-booking-id]");
        this.bookingsCardName = this.bookingsCard.first().locator("p").first();
        this.bookingsCardCancelButton = this.bookingsCard.first().getByRole("button", { name: "Отменить" });
        this.bookingsPastCard = this.bookingsPastSection.locator("[data-booking-id]");
        this.bookingsPastCardName = this.bookingsPastCard.first().locator("p").first();
        this.bookingCancelError = page.getByRole("alert").filter({ hasText: "2 часа" });
    }

    personCard(name: string) {
        return this.catalogCard.filter({ hasText: name });
    }

    async filterCatalog(skillTag: string) {
        await this.catalogFilterInput.fill(skillTag);
        await Promise.all([
            this.page.waitForURL((url) => url.searchParams.get("skill") === skillTag),
            this.catalogFilterSubmit.click(),
        ]);
    }

    async openPerson(name: string) {
        await this.personCard(name).click();
    }

    async personPath(name: string) {
        const href = await this.personCard(name).getAttribute("href");
        if (!href) {
            throw new Error(`В каталоге нет ссылки на участника ${name}`);
        }
        return href;
    }

    async openSlot(time: string) {
        const day = this.slotDays.first();
        await day.waitFor();
        if ((await day.getAttribute("aria-pressed")) !== "true") {
            await day.click();
        }
        const slotTime = this.slotTimes.filter({ hasText: time });
        await slotTime.click();
        try {
            await this.bookingDialog.waitFor({ timeout: 3_000 });
        } catch {
            await slotTime.click();
            await this.bookingDialog.waitFor();
        }
    }

    async confirmBooking() {
        await this.bookingConfirmButton.click();
    }

    async closeBookingDialog() {
        await this.bookingCloseButton.click();
    }

    async bookingCancel() {
        const bookingCancel = this.page.waitForResponse(
          (response) =>
            response.url().endsWith(ROUTES.bookings) && response.request().method() === "POST"
        );
        await this.bookingsCardCancelButton.first().click();
        await bookingCancel;
    }
}