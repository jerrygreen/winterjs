// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
export class User {
    name;
    static users = new Map();
    age;
    constructor(name) {
        this.name = name;
        if (User.users.has(name)) {
            throw new Deno.errors.AlreadyExists(`User ${name} already exists`);
        }
        User.users.set(name, this);
    }
    getAge() {
        if (!this.age) {
            throw new Error("Age unknown");
        }
        return this.age;
    }
    setAge(age) {
        this.age = age;
    }
}
