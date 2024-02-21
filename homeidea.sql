Drop database if exists homeidea;
create database homeidea;
\c homeidea;

drop table if exists users;
create table users(
    user_id VARCHAR NOT NUll,
    chat_id VARCHAR NOT NULL,
    username VARCHAR NOT NULL,
    firstname VARCHAR NOT NULL,
    phone_number VARCHAR NOT NULL,
    user_location VARCHAR[],
    reverse_location VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

drop table if exists applications;
create table applications(
    order_id VARCHAR DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL,
    username VARCHAR NOT NULL,
    phone_number VARCHAR NOT NULL,
    product_code VARCHAR NOT NULL,
    product_name VARCHAR NOT NULL,
    price VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);