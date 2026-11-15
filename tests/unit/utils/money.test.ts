import {
    toMinor,
    fromMinor,
    sumMinor,
    multiplyMinor,
} from "../../../src/pkg/utils/money";

describe("Money Utils Tests", () => {
    it("converts major units to integer minor units accurately", () => {
        expect(toMinor(19.99)).toBe(1999);
        expect(toMinor(100)).toBe(10000);
        expect(toMinor(0)).toBe(0);
    });

    it("converts minor units back to major units", () => {
        expect(fromMinor(1999)).toBe(19.99);
        expect(fromMinor(500)).toBe(5);
    });

    it("sums an array of minor unit amounts", () => {
        expect(sumMinor([1500, 2500, 350])).toBe(4350);
        expect(sumMinor([])).toBe(0);
    });

    it("multiplies unit price in minor units by quantity", () => {
        expect(multiplyMinor(1250, 3)).toBe(3750);
        expect(multiplyMinor(500, 0)).toBe(0);
    });
});

