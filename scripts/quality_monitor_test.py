#!/usr/bin/env python3
import argparse
import json
import sys
import time
from datetime import datetime
from typing import Dict, List, Tuple
import requests
from prometheus_client import CollectorRegistry, Gauge, push_to_gateway


class QualityMonitor:
    def __init__(self, repo: str, graphdb_url: str, pushgateway_url: str = None):
        self.repo = repo
        self.graphdb_url = graphdb_url.rstrip(chr(47))
        self.pushgateway_url = pushgateway_url.rstrip(chr(47)) if pushgateway_url else None
        self.sparql_endpoint = f"{self.graphdb_url}/repositories/{repo}"
        self.registry = CollectorRegistry()

        self.shacl_violations = Gauge(
            chr(39)+chr(101)+chr(107)+chr(103)+chr(95)+chr(115)+chr(104)+chr(97)+chr(99)+chr(108)+chr(95)+chr(118)+chr(105)+chr(111)+chr(108)+chr(97)+chr(116)+chr(105)+chr(111)+chr(110)+chr(115)+chr(95)+chr(116)+chr(111)+chr(116)+chr(97)+chr(108)+chr(39),
            chr(39)+chr(84)+chr(111)+chr(116)+chr(97)+chr(108)+chr(32)+chr(110)+chr(117)+chr(109)+chr(98)+chr(101)+chr(114)+chr(32)+chr(111)+chr(102)+chr(32)+chr(83)+chr(72)+chr(65)+chr(67)+chr(76)+chr(32)+chr(118)+chr(105)+chr(111)+chr(108)+chr(97)+chr(116)+chr(105)+chr(111)+chr(110)+chr(115)+chr(39),
            [chr(39)+chr(115)+chr(101)+chr(118)+chr(101)+chr(114)+chr(105)+chr(116)+chr(121)+chr(39), chr(39)+chr(115)+chr(104)+chr(97)+chr(112)+chr(101)+chr(39)],
            registry=self.registry
        )
        
print(chr(39)+chr(67)+chr(114)+chr(101)+chr(97)+chr(116)+chr(101)+chr(100)+chr(39))
