DROP DATABASE IF EXISTS tempSensors;

CREATE DATABASE tempSensors;
USE tempSensors;

DROP TABLE IF EXISTS Users;

CREATE TABLE Users(
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(32) NOT NULL UNIQUE,
  error_int INT DEFAULT 1800000,
  temp_check_int INT DEFAULT 30000,
  log_int INT DEFAULT 1800000,
  PRIMARY KEY (id)
);

DROP TABLE IF EXISTS Nodes;

CREATE TABLE Nodes(
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_num INT NOT NULL,
    name VARCHAR(32) NOT NULL,
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