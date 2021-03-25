DROP DATABASE IF EXISTS tempSensors;

CREATE DATABASE tempSensors;
USE tempSensors;

DROP TABLE IF EXISTS Users;

CREATE TABLE Users(
  id INT NOT NULL,
  name VARCHAR(32) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

DROP TABLE IF EXISTS Nodes;

CREATE TABLE Nodes(
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

DROP TABLE IF EXISTS Sensors;

CREATE TABLE Sensors(
    id INT NOT NULL AUTO_INCREMENT,
    node_id INT NOT NULL,
    relative_id INT NOT NULL,
    name VARCHAR(32) NOT NULL,
    upper_bound INT,
    lower_bound INT,
    PRIMARY KEY (id),
    FOREIGN KEY (node_id) REFERENCES Nodes(id)

);