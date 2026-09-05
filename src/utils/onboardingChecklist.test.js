import { describe, test, expect } from "vitest";
import { buildOnboardingSteps, computeOnboardingProgress } from "./onboardingChecklist";

describe("buildOnboardingSteps", () => {
  test("hech narsa to'ldirilmagan bo'lsa hammasi 'done: false'", () => {
    const steps = buildOnboardingSteps(null, null);
    expect(steps.every((s) => s.done === false)).toBe(true);
    expect(steps).toHaveLength(5);
  });

  test("do'kon nomi VA logotip ikkalasi ham kerak (faqat bittasi yetarli emas)", () => {
    const steps = buildOnboardingSteps({ storeName: "Zelo" }, null); // logo yo'q
    const step = steps.find((s) => s.key === "storeInfo");
    expect(step.done).toBe(false);
  });

  test("do'kon nomi va logotip ikkalasi ham bo'lsa - bajarilgan", () => {
    const steps = buildOnboardingSteps({ storeName: "Zelo", logo: "https://x.com/logo.png" }, null);
    expect(steps.find((s) => s.key === "storeInfo").done).toBe(true);
  });

  test("mahsulot soni dashboardSummary'dan olinadi", () => {
    const steps = buildOnboardingSteps(null, { totalProductsCount: 3 });
    expect(steps.find((s) => s.key === "firstProduct").done).toBe(true);
  });

  test("bo'sh deliveryTiers obyekti 'to'ldirilmagan' hisoblanadi", () => {
    const steps = buildOnboardingSteps({ deliveryTiers: {} }, null);
    expect(steps.find((s) => s.key === "deliveryZone").done).toBe(false);
  });

  test("kamida bitta bosqich narxi bo'lsa - bajarilgan", () => {
    const steps = buildOnboardingSteps({ deliveryTiers: { sameCity: { price: 15000 } } }, null);
    expect(steps.find((s) => s.key === "deliveryZone").done).toBe(true);
  });

  test("hasEverOrdered=true bo'lsa 'firstOrder' bajarilgan hisoblanadi", () => {
    const steps = buildOnboardingSteps(null, { hasEverOrdered: true });
    expect(steps.find((s) => s.key === "firstOrder").done).toBe(true);
  });

  test("onboardingSharedAt mavjud bo'lsa 'shareStore' bajarilgan hisoblanadi", () => {
    const steps = buildOnboardingSteps({ onboardingSharedAt: 1234567890 }, null);
    expect(steps.find((s) => s.key === "shareStore").done).toBe(true);
  });
});

describe("computeOnboardingProgress", () => {
  test("hech biri bajarilmagan bo'lsa 0%", () => {
    const steps = buildOnboardingSteps(null, null);
    const progress = computeOnboardingProgress(steps);
    expect(progress).toMatchObject({ total: 5, completed: 0, percent: 0, isComplete: false });
  });

  test("hammasi bajarilgan bo'lsa 100% va isComplete=true", () => {
    const steps = buildOnboardingSteps(
      { storeName: "Zelo", logo: "x", deliveryTiers: { sameCity: {} }, onboardingSharedAt: 1 },
      { totalProductsCount: 5, hasEverOrdered: true }
    );
    const progress = computeOnboardingProgress(steps);
    expect(progress).toMatchObject({ total: 5, completed: 5, percent: 100, isComplete: true });
  });

  test("qisman bajarilgan holatni to'g'ri hisoblaydi", () => {
    const steps = buildOnboardingSteps({ storeName: "Zelo", logo: "x" }, { totalProductsCount: 2 });
    const progress = computeOnboardingProgress(steps);
    expect(progress.completed).toBe(2);
    expect(progress.percent).toBe(40);
  });
});
