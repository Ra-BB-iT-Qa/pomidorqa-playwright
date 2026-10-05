import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openGuest, openParticipant } from "../helpers/actor";

const accountContexts: BrowserContext[] = [];
const guestContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await cleanupUsersViaApi(accountContexts);
  accountContexts.length = 0;
  await Promise.all(
    guestContexts.splice(0).map(async (context) => {
      try {
        await context.close();
      } catch (reason) {
        console.warn("Браузерный контекст уже закрыт:", reason);
      }
    })
  );
});

test.describe("Гость", () => {
  test("гость видит каталог и свободные слоты, но не может забронировать", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Korozia-metal-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openGuest(browser, guestContexts);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: добавляет навык «могу помочь»", async () => {
      await host.page.goto(ROUTES.profile);
      await host.profile.addSkill(skillTag, "can_help");
    });

    await test.step("Хост: видит навык в профиле", async () => {
      await expect(host.profile.canHelpSkills).toContainText(skillTag);
    });

    await test.step("Хост: добавляет свободный слот на завтра", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const date = tomorrow.toISOString().slice(0, 10);

      await host.page.goto(ROUTES.mySlots);
      await host.slots.addSlot(date, "12:00");
    });

    await test.step("Хост: видит карточку слота", async () => {
      await expect(host.slots.slotsCard.first()).toBeVisible();
    });

    await test.step("Гость: открывает каталог", async () => {
      await guest.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Гость: видит каталог", async () => {
      await expect(guest.booking.catalogHeading).toBeVisible();
    });

    await test.step("Гость: ищет хоста по навыку", async () => {
      await guest.booking.filterCatalog(skillTag);
    });

    await test.step("Гость: видит карточку хоста", async () => {
      await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста", async () => {
      await guest.booking.openPerson(host.user.name);
    });

    await test.step("Гость: видит имя хоста", async () => {
      await expect(guest.booking.personName).toHaveText(host.user.name);
    });

    await test.step("Гость: видит свободные слоты", async () => {
      await expect(async () => {
        const day = guest.booking.slotDays.first();
        if (!(await day.isVisible().catch(() => false))) {
          await guest.page.reload();
        }
        await expect(day).toBeVisible();
      }).toPass({ timeout: 15_000 });
    });

    await test.step("Гость: открывает свободный слот", async () => {
      await openBookingModal(guest.page);
    });

    await test.step("Гость: видит время свободного слота", async () => {
      await expect(guest.booking.slotTimes.first()).toBeVisible();
      await expect(guest.booking.bookingConfirmButton).toBeVisible();
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: остаётся без брони и видит, что нужен аккаунт", async () => {
      await expect(guest.page).toHaveURL(/\/pomidorqa\/people\//);
      await expect(guest.booking.bookingConfirmError).toHaveText("Нужно войти в аккаунт PomidorQA");
      await expect(guest.booking.bookingConfirmSuccess).toHaveCount(0);
    });
  });
});
