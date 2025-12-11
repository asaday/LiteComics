#!/bin/bash

litecomics --version
git pull
make 
sudo make install-only
sudo systemctl restart litecomics
litecomics --version
