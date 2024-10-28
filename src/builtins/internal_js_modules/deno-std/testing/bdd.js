// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
/** A [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development) interface
 * to `Deno.test()` API.
 *
 * With the `bdd.ts` module you can write your tests in a familiar format for
 * grouping tests and adding setup/teardown hooks used by other JavaScript testing
 * frameworks like Jasmine, Jest, and Mocha.
 *
 * The `describe` function creates a block that groups together several related
 * tests. The `it` function registers an individual test case.
 *
 * ## Hooks
 *
 * There are 4 types of hooks available for test suites. A test suite can have
 * multiples of each type of hook, they will be called in the order that they are
 * registered. The `afterEach` and `afterAll` hooks will be called whether or not
 * the test case passes. The *All hooks will be called once for the whole group
 * while the *Each hooks will be called for each individual test case.
 *
 * - `beforeAll`: Runs before all of the tests in the test suite.
 * - `afterAll`: Runs after all of the tests in the test suite finish.
 * - `beforeEach`: Runs before each of the individual test cases in the test suite.
 * - `afterEach`: Runs after each of the individual test cases in the test suite.
 *
 * If a hook is registered at the top level, a global test suite will be registered
 * and all tests will belong to it. Hooks registered at the top level must be
 * registered before any individual test cases or test suites.
 *
 * ## Focusing tests
 *
 * If you would like to run only specific test cases, you can do so by calling
 * `it.only` instead of `it`. If you would like to run only specific test suites,
 * you can do so by calling `describe.only` instead of `describe`.
 *
 * There is one limitation to this when using the flat test grouping style. When
 * `describe` is called without being nested, it registers the test with
 * `Deno.test`. If a child test case or suite is registered with `it.only` or
 * `describe.only`, it will be scoped to the top test suite instead of the file. To
 * make them the only tests that run in the file, you would need to register the
 * top test suite with `describe.only` too.
 *
 * ## Ignoring tests
 *
 * If you would like to not run specific individual test cases, you can do so by
 * calling `it.ignore` instead of `it`. If you would like to not run specific test
 * suites, you can do so by calling `describe.ignore` instead of `describe`.
 *
 * ## Sanitization options
 *
 * Like `Deno.TestDefinition`, the `DescribeDefinition` and `ItDefinition` have
 * sanitization options. They work in the same way.
 *
 * - `sanitizeExit`: Ensure the test case does not prematurely cause the process to
 *   exit, for example via a call to Deno.exit. Defaults to true.
 * - `sanitizeOps`: Check that the number of async completed ops after the test is
 *   the same as number of dispatched ops. Defaults to true.
 * - `sanitizeResources`: Ensure the test case does not "leak" resources - ie. the
 *   resource table after the test has exactly the same contents as before the
 *   test. Defaults to true.
 *
 * ## Permissions option
 *
 * Like `Deno.TestDefinition`, the `DescribeDefintion` and `ItDefinition` have a
 * `permissions` option. They specify the permissions that should be used to run an
 * individual test case or test suite. Set this to `"inherit"` to keep the calling
 * thread's permissions. Set this to `"none"` to revoke all permissions.
 *
 * This setting defaults to `"inherit"`.
 *
 * There is currently one limitation to this, you cannot use the permissions option
 * on an individual test case or test suite that belongs to another test suite.
 * That's because internally those tests are registered with `t.step` which does
 * not support the permissions option.
 *
 * ## Comparing to Deno\.test
 *
 * The default way of writing tests is using `Deno.test` and `t.step`. The
 * `describe` and `it` functions have similar call signatures to `Deno.test`,
 * making it easy to switch between the default style and the behavior-driven
 * development style of writing tests. Internally, `describe` and `it` are
 * registering tests with `Deno.test` and `t.step`.
 *
 * Below is an example of a test file using `Deno.test` and `t.step`. In the
 * following sections there are examples of how the same test could be written with
 * `describe` and `it` using nested test grouping, flat test grouping, or a mix of
 * both styles.
 *
 * ```ts
 * // https://deno.land/std@$STD_VERSION/testing/bdd_examples/user_test.ts
 * import {
 *   assertEquals,
 *   assertStrictEquals,
 *   assertThrows,
 * } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 * import { User } from "https://deno.land/std@$STD_VERSION/testing/bdd_examples/user";
 *
 * Deno.test("User.users initially empty", () => {
 *   assertEquals(User.users.size, 0);
 * });
 *
 * Deno.test("User constructor", () => {
 *   try {
 *     const user = new User("Kyle");
 *     assertEquals(user.name, "Kyle");
 *     assertStrictEquals(User.users.get("Kyle"), user);
 *   } finally {
 *     User.users.clear();
 *   }
 * });
 *
 * Deno.test("User age", async (t) => {
 *   const user = new User("Kyle");
 *
 *   await t.step("getAge", () => {
 *     assertThrows(() => user.getAge(), Error, "Age unknown");
 *     user.age = 18;
 *     assertEquals(user.getAge(), 18);
 *   });
 *
 *   await t.step("setAge", () => {
 *     user.setAge(18);
 *     assertEquals(user.getAge(), 18);
 *   });
 * });
 * ```
 *
 * ### Nested test grouping
 *
 * Tests created within the callback of a `describe` function call will belong to
 * the new test suite it creates. The hooks can be created within it or be added to
 * the options argument for describe.
 *
 * ```ts
 * // https://deno.land/std@$STD_VERSION/testing/bdd_examples/user_nested_test.ts
 * import {
 *   assertEquals,
 *   assertStrictEquals,
 *   assertThrows,
 * } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 * import {
 *   afterEach,
 *   beforeEach,
 *   describe,
 *   it,
 * } from "https://deno.land/std@$STD_VERSION/testing/bdd";
 * import { User } from "https://deno.land/std@$STD_VERSION/testing/bdd_examples/user";
 *
 * describe("User", () => {
 *   it("users initially empty", () => {
 *     assertEquals(User.users.size, 0);
 *   });
 *
 *   it("constructor", () => {
 *     try {
 *       const user = new User("Kyle");
 *       assertEquals(user.name, "Kyle");
 *       assertStrictEquals(User.users.get("Kyle"), user);
 *     } finally {
 *       User.users.clear();
 *     }
 *   });
 *
 *   describe("age", () => {
 *     let user: User;
 *
 *     beforeEach(() => {
 *       user = new User("Kyle");
 *     });
 *
 *     afterEach(() => {
 *       User.users.clear();
 *     });
 *
 *     it("getAge", function () {
 *       assertThrows(() => user.getAge(), Error, "Age unknown");
 *       user.age = 18;
 *       assertEquals(user.getAge(), 18);
 *     });
 *
 *     it("setAge", function () {
 *       user.setAge(18);
 *       assertEquals(user.getAge(), 18);
 *     });
 *   });
 * });
 * ```
 *
 * ### Flat test grouping
 *
 * The `describe` function returns a unique symbol that can be used to reference
 * the test suite for adding tests to it without having to create them within a
 * callback. The gives you the ability to have test grouping without any extra
 * indentation in front of the grouped tests.
 *
 * ```ts
 * // https://deno.land/std@$STD_VERSION/testing/bdd_examples/user_flat_test.ts
 * import {
 *   assertEquals,
 *   assertStrictEquals,
 *   assertThrows,
 * } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 * import {
 *   describe,
 *   it,
 * } from "https://deno.land/std@$STD_VERSION/testing/bdd";
 * import { User } from "https://deno.land/std@$STD_VERSION/testing/bdd_examples/user";
 *
 * const userTests = describe("User");
 *
 * it(userTests, "users initially empty", () => {
 *   assertEquals(User.users.size, 0);
 * });
 *
 * it(userTests, "constructor", () => {
 *   try {
 *     const user = new User("Kyle");
 *     assertEquals(user.name, "Kyle");
 *     assertStrictEquals(User.users.get("Kyle"), user);
 *   } finally {
 *     User.users.clear();
 *   }
 * });
 *
 * const ageTests = describe({
 *   name: "age",
 *   suite: userTests,
 *   beforeEach(this: { user: User }) {
 *     this.user = new User("Kyle");
 *   },
 *   afterEach() {
 *     User.users.clear();
 *   },
 * });
 *
 * it(ageTests, "getAge", function () {
 *   const { user } = this;
 *   assertThrows(() => user.getAge(), Error, "Age unknown");
 *   user.age = 18;
 *   assertEquals(user.getAge(), 18);
 * });
 *
 * it(ageTests, "setAge", function () {
 *   const { user } = this;
 *   user.setAge(18);
 *   assertEquals(user.getAge(), 18);
 * });
 * ```
 *
 * ### Mixed test grouping
 *
 * Both nested test grouping and flat test grouping can be used together. This can
 * be useful if you'd like to create deep groupings without all the extra
 * indentation in front of each line.
 *
 * ```ts
 * // https://deno.land/std@$STD_VERSION/testing/bdd_examples/user_mixed_test.ts
 * import {
 *   assertEquals,
 *   assertStrictEquals,
 *   assertThrows,
 * } from "https://deno.land/std@$STD_VERSION/testing/asserts";
 * import {
 *   describe,
 *   it,
 * } from "https://deno.land/std@$STD_VERSION/testing/bdd";
 * import { User } from "https://deno.land/std@$STD_VERSION/testing/bdd_examples/user";
 *
 * describe("User", () => {
 *   it("users initially empty", () => {
 *     assertEquals(User.users.size, 0);
 *   });
 *
 *   it("constructor", () => {
 *     try {
 *       const user = new User("Kyle");
 *       assertEquals(user.name, "Kyle");
 *       assertStrictEquals(User.users.get("Kyle"), user);
 *     } finally {
 *       User.users.clear();
 *     }
 *   });
 *
 *   const ageTests = describe({
 *     name: "age",
 *     beforeEach(this: { user: User }) {
 *       this.user = new User("Kyle");
 *     },
 *     afterEach() {
 *       User.users.clear();
 *     },
 *   });
 *
 *   it(ageTests, "getAge", function () {
 *     const { user } = this;
 *     assertThrows(() => user.getAge(), Error, "Age unknown");
 *     user.age = 18;
 *     assertEquals(user.getAge(), 18);
 *   });
 *
 *   it(ageTests, "setAge", function () {
 *     const { user } = this;
 *     user.setAge(18);
 *     assertEquals(user.getAge(), 18);
 *   });
 * });
 * ```
 *
 * @module
 */
import { TestSuiteInternal } from "./_test_suite";
/** Generates an ItDefinition from ItArgs. */
function itDefinition(...args) {
  let [suiteOptionsOrNameOrFn, optionsOrNameOrFn, optionsOrFn, fn] = args;
  let suite = undefined;
  let name;
  let options;
  if (
    typeof suiteOptionsOrNameOrFn === "object" &&
    typeof suiteOptionsOrNameOrFn.symbol === "symbol"
  ) {
    suite = suiteOptionsOrNameOrFn;
  } else {
    fn = optionsOrFn;
    optionsOrFn = optionsOrNameOrFn;
    optionsOrNameOrFn = suiteOptionsOrNameOrFn;
  }
  if (typeof optionsOrNameOrFn === "string") {
    name = optionsOrNameOrFn;
    if (typeof optionsOrFn === "function") {
      fn = optionsOrFn;
      options = {};
    } else {
      options = optionsOrFn;
      if (!fn) fn = options.fn;
    }
  } else if (typeof optionsOrNameOrFn === "function") {
    fn = optionsOrNameOrFn;
    name = fn.name;
    options = {};
  } else {
    options = optionsOrNameOrFn;
    if (typeof optionsOrFn === "function") {
      fn = optionsOrFn;
    } else {
      fn = options.fn;
    }
    name = options.name ?? fn.name;
  }
  return {
    suite,
    ...options,
    name,
    fn,
  };
}
/** Registers an individual test case. */
export function it(...args) {
  if (TestSuiteInternal.runningCount > 0) {
    throw new Error(
      "cannot register new test cases after already registered test cases start running"
    );
  }
  const options = itDefinition(...args);
  const { suite } = options;
  const testSuite = suite
    ? TestSuiteInternal.suites.get(suite.symbol)
    : TestSuiteInternal.current;
  if (!TestSuiteInternal.started) TestSuiteInternal.started = true;
  if (testSuite) {
    TestSuiteInternal.addStep(testSuite, options);
  } else {
    const {
      name,
      fn,
      ignore,
      only,
      permissions,
      sanitizeExit,
      sanitizeOps,
      sanitizeResources,
    } = options;
    TestSuiteInternal.registerTest({
      name,
      ignore,
      only,
      permissions,
      sanitizeExit,
      sanitizeOps,
      sanitizeResources,
      async fn(t) {
        TestSuiteInternal.runningCount++;
        try {
          await fn.call({}, t);
        } finally {
          TestSuiteInternal.runningCount--;
        }
      },
    });
  }
}
it.only = function itOnly(...args) {
  const options = itDefinition(...args);
  return it({
    ...options,
    only: true,
  });
};
it.ignore = function itIgnore(...args) {
  const options = itDefinition(...args);
  return it({
    ...options,
    ignore: true,
  });
};
function addHook(name, fn) {
  if (!TestSuiteInternal.current) {
    if (TestSuiteInternal.started) {
      throw new Error(
        "cannot add global hooks after a global test is registered"
      );
    }
    TestSuiteInternal.current = new TestSuiteInternal({
      name: "global",
      [name]: fn,
    });
  } else {
    TestSuiteInternal.setHook(TestSuiteInternal.current, name, fn);
  }
}
/** Run some shared setup before all of the tests in the suite. */
export function beforeAll(fn) {
  addHook("beforeAll", fn);
}
/** Run some shared teardown after all of the tests in the suite. */
export function afterAll(fn) {
  addHook("afterAll", fn);
}
/** Run some shared setup before each test in the suite. */
export function beforeEach(fn) {
  addHook("beforeEach", fn);
}
/** Run some shared teardown after each test in the suite. */
export function afterEach(fn) {
  addHook("afterEach", fn);
}
/** Generates a DescribeDefinition from DescribeArgs. */
function describeDefinition(...args) {
  let [suiteOptionsOrNameOrFn, optionsOrNameOrFn, optionsOrFn, fn] = args;
  let suite = undefined;
  let name;
  let options;
  if (
    typeof suiteOptionsOrNameOrFn === "object" &&
    typeof suiteOptionsOrNameOrFn.symbol === "symbol"
  ) {
    suite = suiteOptionsOrNameOrFn;
  } else {
    fn = optionsOrFn;
    optionsOrFn = optionsOrNameOrFn;
    optionsOrNameOrFn = suiteOptionsOrNameOrFn;
  }
  if (typeof optionsOrNameOrFn === "string") {
    name = optionsOrNameOrFn;
    if (typeof optionsOrFn === "function") {
      fn = optionsOrFn;
      options = {};
    } else {
      options = optionsOrFn ?? {};
      if (!fn) fn = options.fn;
    }
  } else if (typeof optionsOrNameOrFn === "function") {
    fn = optionsOrNameOrFn;
    name = fn.name;
    options = {};
  } else {
    options = optionsOrNameOrFn ?? {};
    if (typeof optionsOrFn === "function") {
      fn = optionsOrFn;
    } else {
      fn = options.fn;
    }
    name = options.name ?? fn?.name ?? "";
  }
  if (!suite) {
    suite = options.suite;
  }
  if (!suite && TestSuiteInternal.current) {
    const { symbol } = TestSuiteInternal.current;
    suite = { symbol };
  }
  return {
    ...options,
    suite,
    name,
    fn,
  };
}
/** Registers a test suite. */
export function describe(...args) {
  if (TestSuiteInternal.runningCount > 0) {
    throw new Error(
      "cannot register new test suites after already registered test cases start running"
    );
  }
  const options = describeDefinition(...args);
  if (!TestSuiteInternal.started) TestSuiteInternal.started = true;
  const { symbol } = new TestSuiteInternal(options);
  return { symbol };
}
describe.only = function describeOnly(...args) {
  const options = describeDefinition(...args);
  return describe({
    ...options,
    only: true,
  });
};
describe.ignore = function describeIgnore(...args) {
  const options = describeDefinition(...args);
  return describe({
    ...options,
    ignore: true,
  });
};
