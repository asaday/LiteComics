#!/bin/bash

litecomics --version
git pull
make 
sudo make install
sudo systemctl restart litecomics
litecomics --version
