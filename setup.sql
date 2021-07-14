DROP DATABASE IF EXISTS tempSensors;

CREATE DATABASE tempSensors;
USE tempSensors;

DROP TABLE IF EXISTS Users;

CREATE TABLE Users(
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(32) NOT NULL UNIQUE,
  error_int INT DEFAULT 1800000,
  log_int INT DEFAULT 1800000,
  cookie INT UNIQUE,
  PRIMARY KEY (id)
);

DROP TABLE IF EXISTS Nodes;

CREATE TABLE Nodes(
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_num INT NOT NULL,
    name VARCHAR(32) NOT NULL,
    temp_check_int INT DEFAULT 30000,
    last_contact DATETIME,
    error_leds BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

DROP TABLE IF EXISTS Sensors;

CREATE TABLE Sensors(
    id INT NOT NULL AUTO_INCREMENT,
    node_id INT NOT NULL,
    order_num INT NOT NULL,
    name VARCHAR(32) NOT NULL,
    upper_bound INT NOT NULL,
    lower_bound INT NOT NULL,
    address VARCHAR(64),
    temperature INT,
    PRIMARY KEY (id),
    FOREIGN KEY (node_id) REFERENCES Nodes(id)

);

INSERT INTO Users(`id`, `name`) VALUES (1, 'test');
INSERT INTO Nodes(`id`, `user_id`, `order_num`, `name`) VALUES (1, 1, 1, 'Counter');
INSERT INTO Sensors(`id`, `node_id`, `order_num`, `name`, `upper_bound`, `lower_bound`, `address`, `temperature`) VALUES (1, 1, 1, 'warm', 80, 60, '{0x28, 0x0D, 0x5B, 0x07, 0xD6, 0x01, 0x3C, 0x26}', 71);