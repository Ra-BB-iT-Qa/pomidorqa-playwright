import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";

const accountContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await cleanupUsersViaApi(accountContexts);
  accountContexts.length = 0;
});

test("основной путь: регистрация → навык → слот → поиск в каталоге → бронирование → «Мои встречи» у обоих", async ({
  browser,
}) => { 
  const runId = Date.now();
  const skillTag = `Korozia-metal-${runId}`;
  const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
  const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
  const guest2 = await openParticipant(browser, accountContexts, makeUser("Normis2", runId));

  await test.step("Хост: регистрируется в PomidorQA", async () => {
    await registerUserViaApi(host.page, host.user);
  });


  await test.step('Хост: добавляет навык «могу помочь» в профиле', async () => {
    await host.page.goto(ROUTES.profile);
    await host.profile.addSkill(skillTag, "can_help");
  });

  await test.step("Хост: Видит навык в профиле", async () => {
    await expect(host.profile.canHelpSkills).toContainText(skillTag);
  });


  await test.step("Хост: добавляет свободный слот на завтра", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const date = tomorrow.toISOString().slice(0, 10);
    
    await host.page.goto(ROUTES.mySlots);
    await host.slots.addSlot(date, "12:00");
  });

  await test.step("Хост: Видит карточку слота", async () => {
    await expect(host.slots.slotsCard.first()).toBeVisible();
  });

  await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
    await registerUserViaApi(guest.page, guest.user);
  });

  await test.step("Гость: ищет хоста в каталоге по навыку (сценарий 9)", async () => {
    await guest.booking.filterCatalog(skillTag);
  });

  await test.step("Гость: Видит карточку хоста", async () => {
    await expect(
      guest.booking.catalogCard.filter({ hasText: host.user.name })
    ).toBeVisible();
  });

  await test.step("Гость: открывает карточку хоста", async () => {
    await guest.booking.catalogCard.filter({ hasText: host.user.name }).click();
  });

  await test.step("Гость: Видит имя хоста", async () => {
    await expect(guest.booking.personName).toHaveText(host.user.name);
  });

  await test.step("Гость: кликает по дню и времени в календаре слотов", async () => {
    await openBookingModal(guest.page);
  });
  
  await test.step("Гость2: регистрируется отдельным аккаунтом", async () => {
    await registerUserViaApi(guest2.page, guest2.user);
  });
  
  await test.step("Гость2: ищет хоста в каталоге по навыку и открывает карточку хоста", async () => {
    await guest2.booking.filterCatalog(skillTag);
    await guest2.booking.catalogCard.filter({ hasText: host.user.name }).click();
  });

  await test.step("Гость2: Видит имя хоста", async () => {
    await expect(guest2.booking.personName).toHaveText(host.user.name);
  });

  await test.step("Гость2: кликает по дню и времени в календаре слотов", async () => {
    await openBookingModal(guest2.page);
  });
  
  await test.step("Гость: подтверждает бронирование в модалке", async () => {
    await guest.booking.bookingConfirmButton.click();
  });

  await test.step("Гость: Видит успешное бронирование", async () => {
    const success = guest.booking.bookingConfirmSuccess;
    const error = guest.booking.bookingConfirmError;

    await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
    if (await error.isVisible().catch(() => false)) {
      throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
    }
  });

  await test.step("Гость2: пытается забронировать тот же слот вторым", async () => {
    await guest2.booking.bookingConfirmButton.click();
  });

  await test.step("Гость2: Видит ошибку", async () => {
    const success2 = guest2.booking.bookingConfirmSuccess;
    const error2 = guest2.booking.bookingConfirmError;

    await expect(success2.or(error2)).toBeVisible({ timeout: 15_000 });

    // Полярность наоборот относительно гостя 1: ошибка — ожидаемый результат
    if (await success2.isVisible().catch(() => false)) {
      throw new Error("Слот должен был быть занят, но бронирование прошло успешно");
    }
    await expect(error2).toBeVisible();
  });

  await test.step("Гость: видит бронирование в разделе «Мои встречи»", async () => {
    await expect(async () => {
      await guest.page.goto("/pomidorqa/bookings");
      const card = guest.booking.bookingsCardName;
      await expect(card).toHaveText(host.user.name);
    }).toPass({ timeout: 15_000 });
  });

  await test.step("Хост: тоже видит это бронирование в своих «Мои встречи»", async () => {
    await expect(async () => {
      await host.page.goto("/pomidorqa/bookings");
      const card = host.booking.bookingsCardName;
      await expect(card).toHaveText(guest.user.name);
    }).toPass({ timeout: 15_000 });
  });
});
