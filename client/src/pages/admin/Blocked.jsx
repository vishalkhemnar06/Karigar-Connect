// src/components/admin/Blocked.jsx
import React, { useEffect } from 'react';
import PendingReview from './PendingReview';

const Blocked = (props) => {
    useEffect(() => {
        if (props.currentTab !== 'blocked') props.onTabChange('blocked');
    }, [props.currentTab, props.onTabChange]);

    return <PendingReview {...props} lockedTab="blocked" />;
};

export default Blocked;