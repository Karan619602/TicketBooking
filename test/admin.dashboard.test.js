const test = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();

test("admin dashboard APIs", async (t) => {
  const {
    initializeDatabase,
    sequelize,
    User,
    Screen,
    Show,
    Seat,
    Booking,
    Credential,
  } = require("../models");
  const { signToken } = require("../utils/tokens");
  const app = require("../index");

  let screen;
  const userIds = [];
  const screenIds = [];
  const showIds = [];
  let seat;
  let server;

  try {
    await initializeDatabase();

    const baseline = {
      users: await User.count(),
      shows: await Show.count(),
      bookings: await Booking.count(),
      confirmedBookings: await Booking.count({
        where: { status: "confirmed" },
      }),
      cancelledBookings: await Booking.count({
        where: { status: "cancelled" },
      }),
      totalRevenue: Number(
        (await Booking.sum("totalAmount", {
          where: { status: "confirmed" },
        })) || 0,
      ),
    };

    const suffix = Date.now() + "-" + Math.random().toString(36).slice(2);
    const admin = await User.create({
      name: "Dashboard Admin",
      email: "dashboard-admin-" + suffix + "@example.test",
    });
    userIds.push(admin.id);
    const customer = await User.create({
      name: "Dashboard Customer",
      email: "dashboard-customer-" + suffix + "@example.test",
    });
    userIds.push(customer.id);
    const passwordHash = "a".repeat(128);
    const passwordSalt = "b".repeat(64);
    await Credential.create({
      userId: admin.id,
      passwordHash,
      passwordSalt,
      role: "admin",
    });
    await Credential.create({
      userId: customer.id,
      passwordHash,
      passwordSalt,
      role: "customer",
    });

    screen = await Screen.create({
      name: "Dashboard Test Screen " + suffix,
      capacity: 2,
    });
    screenIds.push(screen.id);
    const now = Date.now();
    const firstShow = await Show.create({
      name: "Dashboard Test Show " + suffix,
      screenId: screen.id,
      startTime: new Date(now + 3600000),
      endTime: new Date(now + 7200000),
    });
    showIds.push(firstShow.id);
    const secondShow = await Show.create({
      name: "Dashboard Second Show " + suffix,
      screenId: screen.id,
      startTime: new Date(now + 10800000),
      endTime: new Date(now + 14400000),
    });
    showIds.push(secondShow.id);
    seat = await Seat.create({
      number: 1,
      screenId: screen.id,
      category: "standard",
      price: 350,
    });

    const confirmedBooking = await Booking.create({
      userId: customer.id,
      showId: firstShow.id,
      seatId: seat.id,
      status: "confirmed",
      totalAmount: 350,
    });
    const cancelledBooking = await Booking.create({
      userId: customer.id,
      showId: secondShow.id,
      seatId: seat.id,
      status: "cancelled",
      totalAmount: 125,
    });

    const adminToken = signToken({ sub: admin.id, role: "admin" });
    const customerToken = signToken({ sub: customer.id, role: "customer" });
    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const baseUrl = "http://127.0.0.1:" + server.address().port;
    const adminPaths = [
      "/api/v1/admin/dashboard",
      "/api/v1/admin/users",
      "/api/v1/admin/shows",
      "/api/v1/admin/bookings",
    ];

    async function get(path, token) {
      const headers = token ? { Authorization: "Bearer " + token } : {};
      const response = await fetch(baseUrl + path, { headers });
      return { status: response.status, body: await response.json() };
    }

    async function post(path, body, token) {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      const response = await fetch(baseUrl + path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }

    function assertPagination(pagination, { total, page, limit }) {
      assert.deepEqual(Object.keys(pagination).sort(), [
        "hasNextPage",
        "hasPreviousPage",
        "limit",
        "page",
        "total",
        "totalPages",
      ]);
      assert.equal(pagination.total, total);
      assert.equal(pagination.page, page);
      assert.equal(pagination.limit, limit);
      assert.equal(pagination.totalPages, Math.ceil(total / limit));
      assert.equal(pagination.hasNextPage, page < pagination.totalPages);
      assert.equal(pagination.hasPreviousPage, page > 1);
    }

    function assertNoCredentialData(value) {
      if (Array.isArray(value)) {
        for (const item of value) assertNoCredentialData(item);
      } else if (value && typeof value === "object") {
        for (const [key, nestedValue] of Object.entries(value)) {
          assert.equal(/credential|password|salt/i.test(key), false, key);
          assertNoCredentialData(nestedValue);
        }
      }
    }

    await t.test(
      "dashboard returns counts and confirmed booking revenue",
      async () => {
        const dashboard = await get("/api/v1/admin/dashboard", adminToken);
        assert.equal(dashboard.status, 200);
        assert.deepEqual(dashboard.body.metrics, {
          totalUsers: baseline.users + 2,
          totalShows: baseline.shows + 2,
          totalBookings: baseline.bookings + 2,
          confirmedBookings: baseline.confirmedBookings + 1,
          cancelledBookings: baseline.cancelledBookings + 1,
          totalRevenue: baseline.totalRevenue + 350,
        });
      },
    );

    await t.test("users endpoint paginates users", async () => {
      const users = await get("/api/v1/admin/users?page=1&limit=1", adminToken);
      assert.equal(users.status, 200);
      assert.equal(users.body.users.length, 1);
      assertPagination(users.body.pagination, {
        total: baseline.users + 2,
        page: 1,
        limit: 1,
      });

      const secondPage = await get(
        "/api/v1/admin/users?page=2&limit=1",
        adminToken,
      );
      assert.equal(secondPage.status, 200);
      assertPagination(secondPage.body.pagination, {
        total: baseline.users + 2,
        page: 2,
        limit: 1,
      });

      const allUsers = await get(
        "/api/v1/admin/users?page=1&limit=100",
        adminToken,
      );
      assert.equal(allUsers.status, 200);
      assert.deepEqual(
        allUsers.body.users
          .map((user) => user.id)
          .sort((a, b) => a - b)
          .filter((id) => userIds.includes(id)),
        [...userIds].sort((a, b) => a - b),
      );
      const serializedUsers = JSON.stringify(allUsers.body.users);
      assert.equal(serializedUsers.includes(passwordHash), false);
      assert.equal(serializedUsers.includes(passwordSalt), false);
      assertNoCredentialData(allUsers.body.users);
    });

    await t.test("shows endpoint paginates shows", async () => {
      const shows = await get("/api/v1/admin/shows?page=1&limit=1", adminToken);
      assert.equal(shows.status, 200);
      assert.equal(shows.body.shows.length, 1);
      assertPagination(shows.body.pagination, {
        total: baseline.shows + 2,
        page: 1,
        limit: 1,
      });
    });

    await t.test("bookings endpoint paginates bookings", async () => {
      const bookings = await get(
        "/api/v1/admin/bookings?page=1&limit=1",
        adminToken,
      );
      assert.equal(bookings.status, 200);
      assert.equal(bookings.body.bookings.length, 1);
      assertPagination(bookings.body.pagination, {
        total: baseline.bookings + 2,
        page: 1,
        limit: 1,
      });
    });

    await t.test(
      "booking status filters and associated data work",
      async () => {
        const limit = 100;
        const confirmed = await get(
          "/api/v1/admin/bookings?status=confirmed&page=1&limit=" + limit,
          adminToken,
        );
        assert.equal(confirmed.status, 200);
        assert.ok(confirmed.body.bookings.length >= 1);
        assert.ok(
          confirmed.body.bookings.every(
            (booking) => booking.status === "confirmed",
          ),
        );
        const confirmedResult = confirmed.body.bookings.find(
          (booking) => booking.id === confirmedBooking.id,
        );
        assert.ok(confirmedResult);
        assert.equal(confirmedResult.User.id, customer.id);
        assert.equal(confirmedResult.User.name, customer.name);
        assert.equal(confirmedResult.Show.id, firstShow.id);
        assert.equal(confirmedResult.Show.name, firstShow.name);
        assert.equal(confirmedResult.Seat.id, seat.id);
        assert.equal(confirmedResult.Seat.number, seat.number);
        assertNoCredentialData(confirmedResult.User);

        const cancelled = await get(
          "/api/v1/admin/bookings?status=cancelled&page=1&limit=" + limit,
          adminToken,
        );
        assert.equal(cancelled.status, 200);
        assert.ok(
          cancelled.body.bookings.every(
            (booking) => booking.status === "cancelled",
          ),
        );
        assert.ok(
          cancelled.body.bookings.some(
            (booking) => booking.id === cancelledBooking.id,
          ),
        );

        const invalid = await get(
          "/api/v1/admin/bookings?status=pending",
          adminToken,
        );
        assert.equal(invalid.status, 400);
      },
    );

    await t.test(
      "all admin read endpoints reject unauthenticated and customer users",
      async () => {
        for (const path of adminPaths) {
          assert.equal((await get(path)).status, 401, path);
          assert.equal((await get(path, "invalid-token")).status, 401, path);
          assert.equal((await get(path, customerToken)).status, 403, path);
        }
      },
    );

    await t.test(
      "screen and show creation require admin authorization",
      async () => {
        const screenPath = "/api/v1/screen/create";
        const screenAttempts = [
          { token: null, status: 401 },
          { token: "invalid-token", status: 401 },
          { token: customerToken, status: 403 },
        ];
        const screenStatuses = [];
        for (const [index, attempt] of screenAttempts.entries()) {
          const result = await post(
            screenPath,
            {
              name: "Unauthorized Admin Test Screen " + suffix + "-" + index,
              capacity: 2,
            },
            attempt.token,
          );
          if (result.body.screen && result.body.screen.id) {
            screenIds.push(result.body.screen.id);
          }
          screenStatuses.push(result.status);
        }
        assert.deepEqual(
          screenStatuses,
          screenAttempts.map((attempt) => attempt.status),
        );

        const showAttempts = [
          { token: null, status: 401, offset: 1 },
          { token: "invalid-token", status: 401, offset: 2 },
          { token: customerToken, status: 403, offset: 3 },
        ];
        const showStatuses = [];
        for (const [index, attempt] of showAttempts.entries()) {
          const startTime = new Date(Date.now() + attempt.offset * 86400000);
          const result = await post(
            "/api/v1/show/create/" + screen.id,
            {
              name: "Unauthorized Admin Test Show " + suffix + "-" + index,
              startTime,
              endTime: new Date(startTime.getTime() + 3600000),
            },
            attempt.token,
          );
          if (result.body.show && result.body.show.id) {
            showIds.push(result.body.show.id);
          }
          showStatuses.push(result.status);
        }
        assert.deepEqual(
          showStatuses,
          showAttempts.map((attempt) => attempt.status),
        );
      },
    );

    await t.test("admins can create screens and shows", async () => {
      const createdScreen = await post(
        "/api/v1/screen/create",
        {
          name: "Admin Created Screen " + suffix,
          capacity: 2,
        },
        adminToken,
      );
      if (createdScreen.body.screen && createdScreen.body.screen.id) {
        screenIds.push(createdScreen.body.screen.id);
      }
      assert.equal(createdScreen.status, 201);
      assert.ok(createdScreen.body.screen && createdScreen.body.screen.id);

      const startTime = new Date(Date.now() + 5 * 86400000);
      const createdShow = await post(
        "/api/v1/show/create/" + screen.id,
        {
          name: "Admin Created Show " + suffix,
          startTime,
          endTime: new Date(startTime.getTime() + 3600000),
        },
        adminToken,
      );
      if (createdShow.body.show && createdShow.body.show.id) {
        showIds.push(createdShow.body.show.id);
      }
      assert.equal(createdShow.status, 201);
      assert.ok(createdShow.body.show && createdShow.body.show.id);
    });
  } finally {
    if (server) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    if (userIds.length) {
      await Booking.destroy({ where: { userId: userIds } });
      await Credential.destroy({ where: { userId: userIds } });
      await User.destroy({ where: { id: userIds } });
    }
    if (showIds.length) await Show.destroy({ where: { id: showIds } });
    if (seat) await Seat.destroy({ where: { id: seat.id } });
    if (screenIds.length) {
      await Screen.destroy({ where: { id: screenIds } });
    }
    await sequelize.close();
  }
});
