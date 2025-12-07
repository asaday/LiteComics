#!/bin/bash

litecomics --version
git pull
make 
sudo systemctl stop litecomics
sudo make install
sudo make install-service
sudo systemctl start litecomics
litecomics --version
