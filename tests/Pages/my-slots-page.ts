import { Locator, Page } from "@playwright/test";
import { ROUTES } from "../helpers/user";

export class MySlotsPage {
    page: Page;
    slotsDateInput: Locator;
    slotsTimeInput: Locator;
    slotsAddSubmit: Locator;
    slotForm: Locator;
    slotFields: Locator;
    slotsCard: Locator;
    slotError: Locator;
    timezoneNote: Locator;

    constructor(page: Page) {
        this.page = page;
        this.slotsDateInput = page.locator("#pomidorqa-slots-date");
        this.slotsTimeInput = page.locator("#pomidorqa-slots-time");
        this.slotsAddSubmit = page.getByRole("button", { name: "Добавить слот" });
        this.slotForm = page.getByTestId("AddSlotForm-form");
        this.slotFields = this.slotForm.locator("input:not([type='hidden'])");
        this.slotsCard = page.locator("[data-slot-id]");
        this.slotError = page.getByTestId("AddSlotForm-form").getByRole("alert");
        this.timezoneNote = page.getByText("Время указывается в твоём часовом поясе");
    }

    slotByTime(time: string) {
        return this.slotsCard.filter({ hasText: time });
    }

    deleteButton(time: string) {
        return this.slotByTime(time).getByRole("button", { name: "Удалить" });
    }

    async save() {
        const saved = this.page.waitForResponse(
          (response) => response.url().endsWith("/pomidorqa/my-slots") && response.request().method() === "POST"
        );
        await this.slotsAddSubmit.click();
        await saved;
      }

    async addSlot(date: string, time: string) {
        await this.slotsAddSubmit.waitFor();
        const added = this.page.waitForResponse(
            (response) => response.url().endsWith(ROUTES.mySlots) && response.request().method() === "POST"
          );
        await this.slotsDateInput.fill(date);
        await this.slotsTimeInput.fill(time);
        await this.slotsAddSubmit.click();
        await added;
        await this.slotsAddSubmit.waitFor();
      }

    async deleteSlot(time: string) {
        const removed = this.page.waitForResponse(
            (response) => response.url().endsWith(ROUTES.mySlots) && response.request().method() === "POST"
        );
        await this.slotByTime(time).getByRole("button", { name: "Удалить" }).click();
        await removed;
    }
}
